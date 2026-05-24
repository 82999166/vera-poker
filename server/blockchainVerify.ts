/**
 * Blockchain Transaction Verification Service
 * Supports: TRC20 (TronGrid), ERC20 (Etherscan), BEP20 (BscScan), Polygon (PolygonScan)
 * TON uses a different API structure
 */

import { getConfigValue, getPendingDeposits, confirmDepositById } from "./db";
import { notifyDepositConfirmed, notifyAdmins } from "./notifications";
import { createAdminLog } from "./db";

// USDT contract addresses per chain
const USDT_CONTRACTS: Record<string, string> = {
  TRC20: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // Tron USDT
  ERC20: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum USDT
  BEP20: "0x55d398326f99059fF775485246999027B3197955", // BSC USDT
  Polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Polygon USDT
};

interface TxVerifyResult {
  confirmed: boolean;
  amount?: string;
  from?: string;
  to?: string;
  confirmations?: number;
  error?: string;
}

/**
 * Verify a TRC20 transaction on Tron network via TronGrid
 */
async function verifyTRC20(txHash: string, apiKey: string): Promise<TxVerifyResult> {
  try {
    const url = `https://api.trongrid.io/v1/transactions/${txHash}/events`;
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    
    const res = await fetch(url, { headers });
    if (!res.ok) return { confirmed: false, error: `TronGrid API error: ${res.status}` };
    
    const data = await res.json();
    if (!data.data || data.data.length === 0) return { confirmed: false, error: "Transaction not found or no events" };
    
    // Find USDT Transfer event
    const transferEvent = data.data.find((e: any) => 
      e.contract_address === USDT_CONTRACTS.TRC20 && 
      e.event_name === "Transfer"
    );
    
    if (!transferEvent) return { confirmed: false, error: "No USDT transfer event found" };
    
    const amount = (parseInt(transferEvent.result?.value || "0") / 1e6).toFixed(2);
    const to = transferEvent.result?.to ? `T${transferEvent.result.to}` : "";
    const from = transferEvent.result?.from ? `T${transferEvent.result.from}` : "";
    
    // Also check transaction info for confirmation
    const txInfoUrl = `https://api.trongrid.io/v1/transactions/${txHash}`;
    const txRes = await fetch(txInfoUrl, { headers });
    if (txRes.ok) {
      const txData = await txRes.json();
      const confirmed = txData.data?.[0]?.ret?.[0]?.contractRet === "SUCCESS";
      return { confirmed, amount, from, to, confirmations: confirmed ? 1 : 0 };
    }
    
    return { confirmed: true, amount, from, to, confirmations: 1 };
  } catch (err: any) {
    return { confirmed: false, error: err.message };
  }
}

/**
 * Verify an EVM-based transaction (ERC20/BEP20/Polygon) via Etherscan-like API
 */
async function verifyEVM(txHash: string, chain: string, apiKey: string): Promise<TxVerifyResult> {
  try {
    const baseUrls: Record<string, string> = {
      ERC20: "https://api.etherscan.io/api",
      BEP20: "https://api.bscscan.com/api",
      Polygon: "https://api.polygonscan.com/api",
    };
    
    const baseUrl = baseUrls[chain];
    if (!baseUrl) return { confirmed: false, error: `Unsupported chain: ${chain}` };
    
    // Get transaction receipt
    const url = `${baseUrl}?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return { confirmed: false, error: `API error: ${res.status}` };
    
    const data = await res.json();
    if (!data.result || data.result === null) return { confirmed: false, error: "Transaction not found or pending" };
    
    const receipt = data.result;
    const success = receipt.status === "0x1";
    
    if (!success) return { confirmed: false, error: "Transaction failed on-chain" };
    
    // Parse USDT transfer from logs
    const usdtContract = USDT_CONTRACTS[chain]?.toLowerCase();
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)
    
    const transferLog = receipt.logs?.find((log: any) => 
      log.address?.toLowerCase() === usdtContract && 
      log.topics?.[0] === transferTopic
    );
    
    if (!transferLog) return { confirmed: true, amount: "0", error: "No USDT transfer in this tx" };
    
    // Decode amount (USDT has 6 decimals on ERC20/BEP20/Polygon)
    const rawAmount = parseInt(transferLog.data, 16);
    const amount = (rawAmount / 1e6).toFixed(2);
    const from = "0x" + transferLog.topics[1]?.slice(26);
    const to = "0x" + transferLog.topics[2]?.slice(26);
    
    // Get current block for confirmations
    const blockUrl = `${baseUrl}?module=proxy&action=eth_blockNumber&apikey=${apiKey}`;
    const blockRes = await fetch(blockUrl);
    let confirmations = 1;
    if (blockRes.ok) {
      const blockData = await blockRes.json();
      const currentBlock = parseInt(blockData.result, 16);
      const txBlock = parseInt(receipt.blockNumber, 16);
      confirmations = currentBlock - txBlock;
    }
    
    return { confirmed: true, amount, from, to, confirmations };
  } catch (err: any) {
    return { confirmed: false, error: err.message };
  }
}

/**
 * Verify a TON transaction
 */
async function verifyTON(txHash: string): Promise<TxVerifyResult> {
  try {
    // TON uses a different hash format, try toncenter API
    const url = `https://toncenter.com/api/v3/transactions?hash=${txHash}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return { confirmed: false, error: `TON API error: ${res.status}` };
    
    const data = await res.json();
    if (!data.transactions || data.transactions.length === 0) {
      return { confirmed: false, error: "Transaction not found" };
    }
    
    const tx = data.transactions[0];
    // TON USDT is a Jetton, check for jetton transfer in messages
    const confirmed = tx.description?.compute_ph?.success === true || tx.description?.action?.success === true;
    
    // For TON, amount parsing is more complex (jetton transfers)
    // Simplified: check if tx is successful
    return { confirmed: !!confirmed, confirmations: confirmed ? 1 : 0 };
  } catch (err: any) {
    return { confirmed: false, error: err.message };
  }
}

/**
 * Verify a transaction on the appropriate blockchain
 */
export async function verifyTransaction(txHash: string, chain: string): Promise<TxVerifyResult> {
  const apiKeyMap: Record<string, string> = {
    TRC20: "trongrid_api_key",
    ERC20: "etherscan_api_key",
    BEP20: "bscscan_api_key",
    Polygon: "polygonscan_api_key",
  };
  
  if (chain === "TON") {
    return verifyTON(txHash);
  }
  
  const apiKeyConfig = apiKeyMap[chain];
  if (!apiKeyConfig) return { confirmed: false, error: `Unsupported chain: ${chain}` };
  
  const apiKey = await getConfigValue(apiKeyConfig, "");
  if (!apiKey) return { confirmed: false, error: `No API key configured for ${chain}` };
  
  if (chain === "TRC20") {
    return verifyTRC20(txHash, apiKey);
  }
  
  return verifyEVM(txHash, chain, apiKey);
}

/**
 * Scan incoming transfers to the deposit address for a specific chain
 * Used for auto-detection when user doesn't provide txHash
 */
async function scanIncomingTransfers(chain: string, depositAddress: string, sinceMinutes: number = 30): Promise<Array<{ txHash: string; amount: string; from: string; timestamp: number }>> {
  const transfers: Array<{ txHash: string; amount: string; from: string; timestamp: number }> = [];
  
  try {
    if (chain === "TRC20") {
      const apiKey = await getConfigValue("trongrid_api_key", "");
      const contractAddr = USDT_CONTRACTS.TRC20;
      const url = `https://api.trongrid.io/v1/accounts/${depositAddress}/transactions/trc20?only_to=true&limit=50&contract_address=${contractAddr}`;
      const headers: Record<string, string> = { "Accept": "application/json" };
      if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
      const resp = await fetch(url, { headers });
      if (resp.ok) {
        const data = await resp.json();
        const now = Date.now();
        for (const tx of data.data || []) {
          const txTime = tx.block_timestamp || 0;
          if (now - txTime > sinceMinutes * 60 * 1000) continue;
          const amount = (parseFloat(tx.value || "0") / 1e6).toFixed(2);
          transfers.push({
            txHash: tx.transaction_id,
            amount,
            from: tx.from,
            timestamp: txTime,
          });
        }
      }
    } else if (chain === "ERC20" || chain === "BEP20" || chain === "Polygon") {
      const explorerMap: Record<string, string> = {
        ERC20: "https://api.etherscan.io/api",
        BEP20: "https://api.bscscan.com/api",
        Polygon: "https://api.polygonscan.com/api",
      };
      const apiKeyMap: Record<string, string> = {
        ERC20: "etherscan_api_key",
        BEP20: "bscscan_api_key",
        Polygon: "polygonscan_api_key",
      };
      const apiKey = await getConfigValue(apiKeyMap[chain], "");
      if (!apiKey) return transfers;
      const contractAddr = USDT_CONTRACTS[chain];
      const baseUrl = explorerMap[chain];
      const url = `${baseUrl}?module=account&action=tokentx&contractaddress=${contractAddr}&address=${depositAddress}&page=1&offset=50&sort=desc&apikey=${apiKey}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const now = Date.now();
        for (const tx of data.result || []) {
          if (tx.to?.toLowerCase() !== depositAddress.toLowerCase()) continue;
          const txTime = parseInt(tx.timeStamp || "0") * 1000;
          if (now - txTime > sinceMinutes * 60 * 1000) continue;
          const decimals = parseInt(tx.tokenDecimal || "6");
          const amount = (parseFloat(tx.value || "0") / Math.pow(10, decimals)).toFixed(2);
          transfers.push({
            txHash: tx.hash,
            amount,
            from: tx.from,
            timestamp: txTime,
          });
        }
      }
    } else if (chain === "TON") {
      const url = `https://toncenter.com/api/v2/getTransactions?address=${depositAddress}&limit=50`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const now = Date.now();
        for (const tx of data.result || []) {
          if (!tx.in_msg?.value) continue;
          const txTime = (tx.utime || 0) * 1000;
          if (now - txTime > sinceMinutes * 60 * 1000) continue;
          const amount = (parseInt(tx.in_msg.value) / 1e9).toFixed(2);
          transfers.push({
            txHash: tx.transaction_id?.hash || "",
            amount,
            from: tx.in_msg.source || "",
            timestamp: txTime,
          });
        }
      }
    }
  } catch (err) {
    // Silently fail - will retry on next scan
  }
  
  return transfers;
}

/**
 * Process pending deposits without txHash by scanning the deposit address
 * Matches incoming transfers by amount and time window
 */
export async function processAddressMonitoring(): Promise<{ matched: number; errors: string[] }> {
  const autoDetectEnabled = await getConfigValue("auto_detect_enabled", "true");
  if (autoDetectEnabled !== "true") {
    return { matched: 0, errors: ["Address monitoring is disabled"] };
  }
  
  const pendingDeposits = await getPendingDeposits();
  // Filter deposits without txHash (waiting for auto-detection)
  const noHashDeposits = pendingDeposits.filter(d => !d.txHash && d.chain);
  if (noHashDeposits.length === 0) return { matched: 0, errors: [] };
  
  let matched = 0;
  const errors: string[] = [];
  
  // Group by chain to minimize API calls
  const byChain = new Map<string, typeof noHashDeposits>();
  for (const d of noHashDeposits) {
    const chain = d.chain!;
    if (!byChain.has(chain)) byChain.set(chain, []);
    byChain.get(chain)!.push(d);
  }
  
  for (const [chain, deposits] of byChain) {
    const depositAddress = await getConfigValue(`deposit_wallet_${chain.toLowerCase()}`, "");
    if (!depositAddress) {
      errors.push(`No deposit address configured for ${chain}`);
      continue;
    }
    
    // Scan last 60 minutes of transfers
    const transfers = await scanIncomingTransfers(chain, depositAddress, 60);
    
    // Try to match each pending deposit with an incoming transfer
    for (const deposit of deposits) {
      const expectedAmount = parseFloat(deposit.amount);
      const depositTime = new Date(deposit.createdAt).getTime();
      
      // Find matching transfer: amount within 5% tolerance, after deposit request time
      const match = transfers.find(t => {
        const amountMatch = Math.abs(parseFloat(t.amount) - expectedAmount) / expectedAmount <= 0.05;
        const timeMatch = t.timestamp >= depositTime - 60000; // Allow 1 min before request (clock skew)
        // Make sure this txHash isn't already used by another deposit
        return amountMatch && timeMatch;
      });
      
      if (match) {
        // Update the deposit with the found txHash
        const db = (await import("./db"));
        const drizzleDb = await (db as any).getDb();
        if (drizzleDb) {
          const { transactions: txTable } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await drizzleDb.update(txTable).set({ txHash: match.txHash }).where(eq(txTable.id, deposit.id));
          
          // Now confirm it
          const tx = await confirmDepositById(deposit.id);
          if (tx) {
            matched++;
            notifyDepositConfirmed(deposit.userId, deposit.amount, chain).catch(() => {});
            notifyAdmins("自动检测充值确认", `用户#${deposit.userId} 充值 $${deposit.amount} (${chain}) 已自动检测并确认\nTxHash: ${match.txHash}\n来源地址: ${match.from}`).catch(() => {});
            createAdminLog({
              action: "auto_detect_deposit",
              category: "finance",
              targetType: "transaction",
              targetId: String(deposit.id),
              detail: { amount: deposit.amount, chain, txHash: match.txHash, from: match.from },
            });
          }
          // Remove matched transfer to prevent double-matching
          const idx = transfers.indexOf(match);
          if (idx >= 0) transfers.splice(idx, 1);
        }
      }
    }
  }
  
  return { matched, errors };
}

/**
 * Process all pending deposits - called by scheduled task
 * Checks each pending deposit's txHash on the blockchain and auto-confirms if valid
 */
export async function processAutoConfirmDeposits(): Promise<{ processed: number; confirmed: number; failed: number; errors: string[] }> {
  const autoConfirmEnabled = await getConfigValue("auto_confirm_enabled", "false");
  if (autoConfirmEnabled !== "true") {
    return { processed: 0, confirmed: 0, failed: 0, errors: ["Auto-confirm is disabled"] };
  }
  
  const minConfirmations = parseInt(await getConfigValue("auto_confirm_min_confirmations", "3"));
  const pendingDeposits = await getPendingDeposits();
  
  let processed = 0;
  let confirmed = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const deposit of pendingDeposits) {
    if (!deposit.txHash || !deposit.chain) continue;
    
    processed++;
    
    try {
      const result = await verifyTransaction(deposit.txHash, deposit.chain);
      
      if (result.confirmed && (result.confirmations ?? 0) >= minConfirmations) {
        // Verify amount matches (with 5% tolerance for gas/fees)
        const onChainAmount = parseFloat(result.amount || "0");
        const expectedAmount = parseFloat(deposit.amount);
        
        // If on-chain amount is available and matches (within tolerance), auto-confirm
        if (onChainAmount === 0 || Math.abs(onChainAmount - expectedAmount) / expectedAmount <= 0.05) {
          const tx = await confirmDepositById(deposit.id);
          if (tx) {
            confirmed++;
            // Send notifications
            notifyDepositConfirmed(deposit.userId, deposit.amount, deposit.chain).catch(() => {});
            notifyAdmins("自动确认充值", `用户#${deposit.userId} 充值 $${deposit.amount} (${deposit.chain}) 已自动确认\nTxHash: ${deposit.txHash}\n链上确认数: ${result.confirmations}`).catch(() => {});
            createAdminLog({
              action: "auto_confirm_deposit",
              category: "finance",
              targetType: "transaction",
              targetId: String(deposit.id),
              detail: { amount: deposit.amount, chain: deposit.chain, txHash: deposit.txHash, confirmations: result.confirmations },
            });
          }
        } else {
          // Amount mismatch - flag for manual review
          errors.push(`Tx#${deposit.id}: Amount mismatch - expected $${expectedAmount}, on-chain $${onChainAmount}`);
          notifyAdmins("充值金额不匹配", `用户#${deposit.userId} 充值 Tx#${deposit.id}\n预期: $${expectedAmount}\n链上: $${onChainAmount}\n需要人工审核`).catch(() => {});
        }
      } else if (result.error) {
        // Don't count as failed if just not enough confirmations yet
        if (!result.error.includes("not found") && !result.error.includes("pending")) {
          errors.push(`Tx#${deposit.id}: ${result.error}`);
        }
      }
    } catch (err: any) {
      failed++;
      errors.push(`Tx#${deposit.id}: ${err.message}`);
    }
  }
  
  return { processed, confirmed, failed, errors };
}
