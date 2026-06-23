/**
 * HD 钱包服务 - TRON (TRC20) 自动充值系统
 * 
 * 架构设计：
 * 1. 地址派生：基于主助记词 (BIP39/BIP44) 为每个用户派生独立充值地址
 * 2. 链上监听：通过 TronGrid API 扫描用户地址的 USDT 入账
 * 3. 自动到账：检测到充值后自动增加用户余额
 * 4. 资金归集：将子地址资金归集到主钱包（可配置阈值）
 * 
 * 安全措施：
 * - 主助记词从 system_configs 加密存储，运行时解密
 * - 子地址私钥加密存储（AES-256-GCM）
 * - 交易哈希唯一索引防止重复入账
 * - 原子性余额更新防止竞态条件
 */

import { getConfigValue, getDb, addUserBalanceAtomic } from "./db";
import { notifyDepositConfirmed, notifyAdmins } from "./notifications";
import { createAdminLog } from "./db";
import { depositAddresses, chainDeposits, consolidations, transactions, users } from "../drizzle/schema";
import { eq, and, sql, inArray, isNull, lte } from "drizzle-orm";
import crypto from "crypto";

// ==================== 常量 ====================

const TRON_PATH_PREFIX = "m/44'/195'/0'/0"; // BIP44 TRON 派生路径
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_BASE_URL = "https://api.trongrid.io";

// ==================== 加密工具 ====================

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  // 使用 JWT_SECRET 派生加密密钥（32 bytes for AES-256）
  const secret = process.env.JWT_SECRET || "default-secret-change-me";
  return crypto.scryptSync(secret, "hd-wallet-salt", 32);
}

export function encryptPrivateKey(privateKey: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(privateKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptPrivateKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ==================== HD 地址派生 ====================

/**
 * 从助记词派生 TRON 地址
 * 使用 BIP44 路径: m/44'/195'/0'/0/{index}
 */
export async function deriveAddress(mnemonic: string, index: number): Promise<{ address: string; privateKey: string }> {
  const bip39 = await import("bip39");
  const HDKey = (await import("hdkey")).default;
  const { TronWeb } = await import("tronweb");

  // 助记词 → 种子
  const seed = await bip39.mnemonicToSeed(mnemonic);
  
  // 种子 → HD 根密钥
  const root = HDKey.fromMasterSeed(Buffer.from(seed));
  
  // 派生子密钥
  const child = root.derive(`${TRON_PATH_PREFIX}/${index}`);
  const privateKey = child.privateKey!.toString("hex");
  
  // 私钥 → TRON 地址
  const address = TronWeb.address.fromPrivateKey(privateKey);
  
  return { address: address as string, privateKey };
}

/**
 * 获取下一个可用的派生索引
 * 注意：从 1 开始，跳过 index=0（index=0 通常是助记词对应的主钱包地址）
 */
async function getNextDerivationIndex(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(derivationIndex), 0) + 1 as nextIndex FROM deposit_addresses WHERE chain = 'TRC20'`
  );
  const nextIndex = (result as any)[0]?.[0]?.nextIndex ?? 1;
  // 确保最小从 1 开始（跳过 index=0，它是主钱包地址）
  return Math.max(nextIndex, 1);
}

/**
 * 为用户生成或获取充值地址
 * 如果用户已有地址则直接返回，否则派生新地址
 */
export async function getOrCreateDepositAddress(userId: number, chain: string = "TRC20"): Promise<{
  address: string;
  isNew: boolean;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 检查用户是否已有该链的充值地址
  const existing = await db.select()
    .from(depositAddresses)
    .where(and(
      eq(depositAddresses.userId, userId),
      eq(depositAddresses.chain, chain),
      eq(depositAddresses.status, "active")
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return { address: existing[0].address, isNew: false };
  }
  
  // 获取主助记词
  const mnemonic = await getConfigValue("hd_wallet_mnemonic", "");
  if (!mnemonic) {
    throw new Error("HD wallet mnemonic not configured. Please set 'hd_wallet_mnemonic' in system configs.");
  }
  
  // 获取下一个派生索引（从1开始，跳过0号主钱包地址）
  let derivationIndex = await getNextDerivationIndex();
  
  // 获取主钱包地址（归集目标），确保不会把主钱包地址分配给用户
  const mainWalletAddress = await getConfigValue("hd_main_wallet_address", "");
  
  // 派生新地址，如果与主钱包地址相同则跳过
  let address: string;
  let privateKey: string;
  let attempts = 0;
  do {
    const derived = await deriveAddress(mnemonic, derivationIndex);
    address = derived.address;
    privateKey = derived.privateKey;
    if (mainWalletAddress && address.toLowerCase() === mainWalletAddress.toLowerCase()) {
      console.log(`[HDWallet] Skipping index ${derivationIndex} (matches main wallet address)`);
      derivationIndex++;
      attempts++;
    } else {
      break;
    }
  } while (attempts < 5);
  
  // 加密私钥后存储
  const privateKeyEnc = encryptPrivateKey(privateKey);
  
  // 写入数据库
  await db.insert(depositAddresses).values({
    userId,
    chain,
    address,
    derivationIndex,
    privateKeyEnc,
    status: "active",
  });
  
  console.log(`[HDWallet] Generated deposit address for user#${userId}: ${address} (index: ${derivationIndex})`);
  
  return { address, isNew: true };
}

// ==================== 链上监听 ====================

/**
 * 扫描所有活跃充值地址的 USDT 入账
 * 通过 TronGrid API 批量查询
 */
export async function scanAllDepositAddresses(): Promise<{
  detected: number;
  credited: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) return { detected: 0, credited: 0, errors: ["Database not available"] };
  
  // 检查功能是否启用
  const enabled = await getConfigValue("hd_auto_detect_enabled", "true");
  if (enabled !== "true") {
    return { detected: 0, credited: 0, errors: ["HD auto-detect is disabled"] };
  }
  
  const apiKey = await getConfigValue("trongrid_api_key", "");
  const minAmount = parseFloat(await getConfigValue("hd_min_deposit_amount", "1"));
  const requiredConfirmations = parseInt(await getConfigValue("hd_min_confirmations", "1"));
  
  // 获取所有活跃的充值地址
  const activeAddresses = await db.select()
    .from(depositAddresses)
    .where(and(
      eq(depositAddresses.chain, "TRC20"),
      eq(depositAddresses.status, "active")
    ));
  
  if (activeAddresses.length === 0) {
    return { detected: 0, credited: 0, errors: [] };
  }
  
  let detected = 0;
  let credited = 0;
  const errors: string[] = [];
  
  // 批量扫描（每次处理 20 个地址，避免 API 限流）
  const batchSize = 20;
  for (let i = 0; i < activeAddresses.length; i += batchSize) {
    const batch = activeAddresses.slice(i, i + batchSize);
    
    for (const addrRecord of batch) {
      try {
        const transfers = await scanAddressTransfers(addrRecord.address, apiKey, addrRecord.lastScannedAt);
        
        for (const tx of transfers) {
          // 检查是否已记录过该交易
          const existingTx = await db.select({ id: chainDeposits.id })
            .from(chainDeposits)
            .where(eq(chainDeposits.txHash, tx.txHash))
            .limit(1);
          
          if (existingTx.length > 0) continue; // 已处理过
          
          const amount = parseFloat(tx.amount);
          if (amount < minAmount) continue; // 低于最小充值额
          
          // 记录链上充值
          await db.insert(chainDeposits).values({
            userId: addrRecord.userId,
            depositAddressId: addrRecord.id,
            chain: "TRC20",
            txHash: tx.txHash,
            fromAddress: tx.from,
            toAddress: addrRecord.address,
            amount: tx.amount,
            confirmations: tx.confirmations,
            blockNumber: tx.blockNumber ? tx.blockNumber : null,
            blockTimestamp: tx.timestamp ? new Date(tx.timestamp) : null,
            status: tx.confirmations >= requiredConfirmations ? "confirmed" : "detected",
          });
          
          detected++;
          
          // 如果确认数足够，自动到账
          if (tx.confirmations >= requiredConfirmations) {
            const creditResult = await creditUserDeposit(
              addrRecord.userId,
              tx.txHash,
              amount,
              addrRecord.id
            );
            if (creditResult.success) {
              credited++;
            } else {
              errors.push(`Credit failed for tx ${tx.txHash}: ${creditResult.error}`);
            }
          }
        }
        
        // 更新最后扫描时间
        await db.update(depositAddresses)
          .set({ lastScannedAt: new Date() })
          .where(eq(depositAddresses.id, addrRecord.id));
        
      } catch (err: any) {
        errors.push(`Scan error for ${addrRecord.address}: ${err.message}`);
      }
    }
    
    // 批次间延迟，避免 API 限流
    if (i + batchSize < activeAddresses.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  if (detected > 0 || credited > 0) {
    console.log(`[HDWallet] Scan complete: ${detected} detected, ${credited} credited`);
  }
  
  return { detected, credited, errors };
}

/**
 * 扫描单个地址的 TRC20 USDT 入账
 */
async function scanAddressTransfers(
  address: string,
  apiKey: string,
  lastScannedAt: Date | null
): Promise<Array<{
  txHash: string;
  amount: string;
  from: string;
  confirmations: number;
  blockNumber: number;
  timestamp: number;
}>> {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
  
  // 查询该地址的 TRC20 转入记录
  let url = `${TRONGRID_BASE_URL}/v1/accounts/${address}/transactions/trc20?only_to=true&limit=50&contract_address=${USDT_TRC20_CONTRACT}`;
  
  // 如果有上次扫描时间，只查询之后的交易
  if (lastScannedAt) {
    const minTimestamp = lastScannedAt.getTime();
    url += `&min_timestamp=${minTimestamp}`;
  }
  
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    throw new Error(`TronGrid API error: ${resp.status} ${resp.statusText}`);
  }
  
  const data = await resp.json();
  const transfers: Array<{
    txHash: string;
    amount: string;
    from: string;
    confirmations: number;
    blockNumber: number;
    timestamp: number;
  }> = [];
  
  for (const tx of data.data || []) {
    const amount = (parseFloat(tx.value || "0") / 1e6).toFixed(6);
    transfers.push({
      txHash: tx.transaction_id,
      amount,
      from: tx.from || "",
      confirmations: 1, // TRC20 confirmed transactions are already final
      blockNumber: tx.block_timestamp ? Math.floor(tx.block_timestamp / 3000) : 0,
      timestamp: tx.block_timestamp || 0,
    });
  }
  
  return transfers;
}

// ==================== 自动到账 ====================

/**
 * 将链上充值记入用户余额
 * 原子操作：创建 transaction 记录 + 更新余额 + 更新 chain_deposits 状态
 */
async function creditUserDeposit(
  userId: number,
  txHash: string,
  amount: number,
  depositAddressId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };
  
  try {
    // 1. 获取用户当前余额（用于记录 balanceBefore/After）
    const [userRow] = await db.select({ balance: users.balance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const balanceBefore = parseFloat(userRow?.balance || "0");
    const balanceAfter = balanceBefore + amount;
    
    // 2. 创建 transaction 记录（充值流水）
    const [insertResult] = await db.insert(transactions).values({
      userId,
      type: "deposit",
      amount: amount.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      status: "confirmed",
      chain: "TRC20",
      txHash,
      note: `HD钱包自动充值 (TRC20 USDT)`,
    }).$returningId();
    
    const transactionId = insertResult.id;
    
    // 2. 原子性增加用户余额
    const newBalance = await addUserBalanceAtomic(userId, amount);
    if (!newBalance) {
      return { success: false, error: "Failed to update user balance" };
    }
    
    // 3. 更新 chain_deposits 状态
    await db.update(chainDeposits)
      .set({
        status: "credited",
        creditedAmount: amount.toFixed(2),
        creditedAt: new Date(),
        transactionId,
      })
      .where(eq(chainDeposits.txHash, txHash));
    
    // 4. 更新充值地址累计充值额
    await db.execute(
      sql`UPDATE deposit_addresses SET totalDeposited = totalDeposited + ${amount} WHERE id = ${depositAddressId}`
    );
    
    // 5. 发送通知
    notifyDepositConfirmed(userId, amount.toFixed(2), "TRC20").catch(() => {});
    notifyAdmins(
      "HD钱包自动充值到账",
      `用户#${userId} 充值 $${amount.toFixed(2)} (TRC20 USDT) 已自动到账\nTxHash: ${txHash}`
    ).catch(() => {});
    
    // 6. 记录管理日志
    createAdminLog({
      action: "hd_auto_credit",
      category: "finance",
      targetType: "transaction",
      targetId: String(transactionId),
      detail: { userId, amount, chain: "TRC20", txHash },
    });
    
    console.log(`[HDWallet] Auto-credited $${amount.toFixed(2)} to user#${userId} (tx: ${txHash})`);
    
    return { success: true };
  } catch (err: any) {
    // 如果是唯一索引冲突（重复交易），静默处理
    if (err.code === "ER_DUP_ENTRY") {
      return { success: false, error: "Duplicate transaction" };
    }
    console.error(`[HDWallet] Credit error for user#${userId}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ==================== 确认待处理充值 ====================

/**
 * 检查 "detected" 状态的充值是否已达到确认数要求
 * 用于处理首次扫描时确认数不足的情况
 */
export async function confirmPendingDeposits(): Promise<{ confirmed: number }> {
  const db = await getDb();
  if (!db) return { confirmed: 0 };
  
  const requiredConfirmations = parseInt(await getConfigValue("hd_min_confirmations", "1"));
  
  // 查找 detected 但未 credited 的记录
  const pending = await db.select()
    .from(chainDeposits)
    .where(eq(chainDeposits.status, "detected"));
  
  let confirmed = 0;
  
  for (const deposit of pending) {
    // TRC20 交易一旦上链就是最终的（不可逆），所以 detected 状态可以直接确认
    if (deposit.confirmations >= requiredConfirmations) {
      const creditResult = await creditUserDeposit(
        deposit.userId,
        deposit.txHash,
        parseFloat(deposit.amount),
        deposit.depositAddressId
      );
      if (creditResult.success) confirmed++;
    }
  }
  
  return { confirmed };
}

// ==================== 资金归集 ====================

/**
 * 执行资金归集：将子地址的 USDT 转移到主钱包
 */
export async function consolidateFunds(): Promise<{
  consolidated: number;
  totalAmount: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) return { consolidated: 0, totalAmount: 0, errors: ["Database not available"] };
  
  // 检查功能是否启用
  const enabled = await getConfigValue("hd_consolidation_enabled", "false");
  if (enabled !== "true") {
    return { consolidated: 0, totalAmount: 0, errors: ["Consolidation is disabled"] };
  }
  
  const threshold = parseFloat(await getConfigValue("hd_consolidation_threshold", "50"));
  const mainWallet = await getConfigValue("hd_main_wallet_address", "");
  if (!mainWallet) {
    return { consolidated: 0, totalAmount: 0, errors: ["Main wallet address not configured"] };
  }
  
  const apiKey = await getConfigValue("trongrid_api_key", "");
  
  // 查找累计充值超过阈值的地址
  const addressesToConsolidate = await db.select()
    .from(depositAddresses)
    .where(and(
      eq(depositAddresses.chain, "TRC20"),
      eq(depositAddresses.status, "active"),
      sql`totalDeposited >= ${threshold}`
    ));
  
  let consolidated = 0;
  let totalAmount = 0;
  const errors: string[] = [];
  
  for (const addrRecord of addressesToConsolidate) {
    try {
      // 查询子地址当前 USDT 余额
      const balance = await getAddressUSDTBalance(addrRecord.address, apiKey);
      if (balance < 1) continue; // 余额太低不归集
      
      // 解密私钥
      if (!addrRecord.privateKeyEnc) {
        errors.push(`No encrypted key for address ${addrRecord.address}`);
        continue;
      }
      const privateKey = decryptPrivateKey(addrRecord.privateKeyEnc);
      
      // 执行 USDT 转账到主钱包
      const txHash = await transferUSDT(privateKey, addrRecord.address, mainWallet, balance, apiKey);
      
      if (txHash) {
        // 记录归集
        await db.insert(consolidations).values({
          fromAddress: addrRecord.address,
          toAddress: mainWallet,
          chain: "TRC20",
          amount: balance.toFixed(6),
          txHash,
          status: "submitted",
        });
        
        // 重置累计充值额
        await db.update(depositAddresses)
          .set({ totalDeposited: "0" })
          .where(eq(depositAddresses.id, addrRecord.id));
        
        consolidated++;
        totalAmount += balance;
        
        console.log(`[HDWallet] Consolidated $${balance.toFixed(2)} from ${addrRecord.address} to main wallet`);
      }
    } catch (err: any) {
      errors.push(`Consolidation error for ${addrRecord.address}: ${err.message}`);
    }
  }
  
  if (consolidated > 0) {
    notifyAdmins(
      "资金归集完成",
      `已归集 ${consolidated} 个地址，总金额 $${totalAmount.toFixed(2)} USDT`
    ).catch(() => {});
  }
  
  return { consolidated, totalAmount, errors };
}

/**
 * 查询地址的 USDT 余额
 */
async function getAddressUSDTBalance(address: string, apiKey: string): Promise<number> {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
  
  const url = `${TRONGRID_BASE_URL}/v1/accounts/${address}/tokens?token_id=${USDT_TRC20_CONTRACT}`;
  const resp = await fetch(url, { headers });
  
  if (!resp.ok) return 0;
  
  const data = await resp.json();
  // TronGrid v1 token balance response
  for (const token of data.data || []) {
    if (token.tokenId === USDT_TRC20_CONTRACT || token.token_id === USDT_TRC20_CONTRACT) {
      return parseFloat(token.balance || "0") / 1e6;
    }
  }
  
  return 0;
}

/**
 * 执行 TRC20 USDT 转账
 */
async function transferUSDT(
  fromPrivateKey: string,
  fromAddress: string,
  toAddress: string,
  amount: number,
  apiKey: string
): Promise<string | null> {
  const { TronWeb } = await import("tronweb");
  
  const tronWeb = new TronWeb({
    fullHost: TRONGRID_BASE_URL,
    headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : undefined,
    privateKey: fromPrivateKey,
  });
  
  try {
    // 构建 TRC20 转账交易
    const amountSun = Math.floor(amount * 1e6); // USDT 6 位小数
    
    const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
    const tx = await contract.methods.transfer(toAddress, amountSun).send({
      feeLimit: 100_000_000, // 100 TRX fee limit
      callValue: 0,
    });
    
    return typeof tx === "string" ? tx : (tx as any)?.txid || null;
  } catch (err: any) {
    console.error(`[HDWallet] Transfer failed from ${fromAddress}:`, err.message);
    throw err;
  }
}

// ==================== 管理接口 ====================

/**
 * 获取 HD 钱包统计信息
 */
export async function getHDWalletStats(): Promise<{
  totalAddresses: number;
  totalDeposits: number;
  totalCredited: number;
  pendingDeposits: number;
  totalConsolidated: number;
}> {
  const db = await getDb();
  if (!db) return { totalAddresses: 0, totalDeposits: 0, totalCredited: 0, pendingDeposits: 0, totalConsolidated: 0 };
  
  const [addrCount] = await db.execute(sql`SELECT COUNT(*) as cnt FROM deposit_addresses WHERE status = 'active'`);
  const [depositStats] = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'credited' THEN 1 ELSE 0 END) as credited,
      SUM(CASE WHEN status IN ('detected', 'confirmed') THEN 1 ELSE 0 END) as pending,
      COALESCE(SUM(CASE WHEN status = 'credited' THEN creditedAmount ELSE 0 END), 0) as totalCreditedAmount
    FROM chain_deposits
  `);
  const [consolidateStats] = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0) as total FROM consolidations WHERE status = 'confirmed'
  `);
  
  return {
    totalAddresses: (addrCount as any)[0]?.cnt || 0,
    totalDeposits: (depositStats as any)[0]?.total || 0,
    totalCredited: parseFloat((depositStats as any)[0]?.totalCreditedAmount || "0"),
    pendingDeposits: (depositStats as any)[0]?.pending || 0,
    totalConsolidated: parseFloat((consolidateStats as any)[0]?.total || "0"),
  };
}

/**
 * 验证助记词是否有效
 */
export async function validateMnemonic(mnemonic: string): Promise<boolean> {
  const bip39 = await import("bip39");
  return bip39.validateMnemonic(mnemonic);
}

/**
 * 从助记词生成主钱包地址（用于验证配置）
 */
export async function getMasterAddress(mnemonic: string): Promise<string> {
  const { address } = await deriveAddress(mnemonic, 0);
  return address;
}
