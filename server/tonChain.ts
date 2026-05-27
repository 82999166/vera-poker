/**
 * TON On-Chain Service
 * Writes hand batch hashes to TON blockchain for provably fair verification.
 * Strategy: batch hash per hand (SHA-256 of serverSeed + clientSeed + deckHash + handId)
 * is stored as a comment in a TON transfer transaction to the same wallet (self-transfer).
 */
import crypto from "crypto";
import * as db from "./db";

// Lazy-load TON SDK to avoid startup errors if not configured
let tonInitialized = false;
let walletContract: any = null;
let tonClient: any = null;

async function initTonWallet() {
  if (tonInitialized) return { walletContract, tonClient };

  const mnemonic = await getWalletMnemonic();
  if (!mnemonic) {
    console.warn("[TON] Wallet mnemonic not configured, skipping on-chain write");
    return { walletContract: null, tonClient: null };
  }

  try {
    const { mnemonicToPrivateKey } = await import("@ton/crypto");
    const { WalletContractV4, TonClient } = await import("@ton/ton");

    const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });

    const client = new TonClient({
      endpoint: "https://toncenter.com/api/v2/jsonRPC",
    });

    walletContract = { wallet, keyPair, contract: client.open(wallet) };
    tonClient = client;
    tonInitialized = true;
    console.log("[TON] Wallet initialized:", wallet.address.toString());
    return { walletContract, tonClient };
  } catch (e) {
    console.error("[TON] Failed to initialize wallet:", e);
    return { walletContract: null, tonClient: null };
  }
}

async function getWalletMnemonic(): Promise<string | null> {
  // Priority: system config DB > env var
  try {
    const config = await db.getConfig("ton_onchain_wallet_mnemonic");
    if (config?.value) return config.value;
  } catch {}
  return process.env.TON_WALLET_MNEMONIC ?? null;
}

async function getWalletAddress(): Promise<string | null> {
  try {
    const config = await db.getConfig("ton_onchain_wallet_address");
    if (config?.value) return config.value;
  } catch {}
  return process.env.TON_WALLET_ADDRESS ?? null;
}

/**
 * Compute the hand hash: SHA-256 of (handId + serverSeed + clientSeed + deckHash)
 */
export function computeHandHash(params: {
  handId: number;
  serverSeed: string | null;
  clientSeed: string | null;
  deckHash: string | null;
}): string {
  const data = `${params.handId}:${params.serverSeed ?? ""}:${params.clientSeed ?? ""}:${params.deckHash ?? ""}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Write hand hash to TON blockchain as a comment on a self-transfer.
 * Amount: 0.005 TON (minimum viable transfer).
 * Comment format: "VERA:HAND:{handId}:{hash}"
 */
export async function writeHandHashToChain(handId: number, handHash: string): Promise<string | null> {
  try {
    const { walletContract: wc } = await initTonWallet();
    if (!wc) return null;

    const { internal, toNano } = await import("@ton/ton");
    const { beginCell } = await import("@ton/core");

    const comment = `VERA:HAND:${handId}:${handHash}`;
    const seqno = await wc.contract.getSeqno();

    const transfer = wc.contract.createTransfer({
      seqno,
      secretKey: wc.keyPair.secretKey,
      messages: [
        internal({
          to: wc.wallet.address,
          value: toNano("0.005"),
          body: beginCell()
            .storeUint(0, 32) // text comment op
            .storeStringTail(comment)
            .endCell(),
        }),
      ],
    });

    await wc.contract.send(transfer);

    // Wait for transaction to appear (poll for up to 30s)
    const txHash = await waitForTransaction(wc, seqno, 30000);
    console.log(`[TON] Hand ${handId} hash written to chain. TX: ${txHash}`);
    return txHash;
  } catch (e) {
    console.error(`[TON] Failed to write hand ${handId} to chain:`, e);
    return null;
  }
}

async function waitForTransaction(wc: any, seqno: number, timeoutMs: number): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const currentSeqno = await wc.contract.getSeqno();
      if (currentSeqno > seqno) {
        // Transaction confirmed, get the tx hash from recent transactions
        const txs = await wc.contract.getTransactions({ limit: 1 });
        if (txs && txs.length > 0) {
          const tx = txs[0];
          return tx.hash().toString("hex");
        }
        return "confirmed";
      }
    } catch {}
  }
  return null;
}

/**
 * Main entry point: called after a hand completes.
 * Only writes to chain if room fairnessLevel === "high".
 */
export async function onHandCompleted(params: {
  handId: number;
  roomId: number;
  fairnessLevel: string;
  serverSeed: string | null;
  clientSeed: string | null;
  deckHash: string | null;
}): Promise<void> {
  if (params.fairnessLevel !== "high") return; // Only VIP/high-stakes rooms

  const handHash = computeHandHash({
    handId: params.handId,
    serverSeed: params.serverSeed,
    clientSeed: params.clientSeed,
    deckHash: params.deckHash,
  });

  // Fire-and-forget: don't block game flow
  writeHandHashToChain(params.handId, handHash)
    .then(async (txHash) => {
      if (txHash) {
        // Save txHash back to game_hands table
        await db.updateGameHand(params.handId, { txHash });
        console.log(`[TON] Hand ${params.handId} on-chain TX saved: ${txHash}`);
      }
    })
    .catch(e => console.error("[TON] onHandCompleted error:", e));
}
