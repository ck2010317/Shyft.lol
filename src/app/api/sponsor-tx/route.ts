import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

/**
 * /api/sponsor-tx — Treasury signs as fee payer for user transactions.
 *
 * Flow:
 * 1. Frontend builds tx with feePayer = treasury pubkey
 * 2. Frontend partially signs with user wallet (signTransaction)
 * 3. Frontend sends the serialized partially-signed tx here
 * 4. Backend adds treasury signature (as fee payer)
 * 5. Backend sends the fully-signed tx to Solana
 * 6. Returns the tx signature
 *
 * This means the user NEVER needs SOL in their wallet. The treasury pays
 * all transaction fees and rent.
 */

function getTreasuryKeypair(): Keypair {
  const secret = process.env.TREASURY_PRIVATE_KEY;
  if (!secret) throw new Error("TREASURY_PRIVATE_KEY not set");
  const bytes = JSON.parse(secret) as number[];
  return Keypair.fromSecretKey(new Uint8Array(bytes));
}

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1";

// Rate limit: max 10 sponsored tx per wallet per minute
const txTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

// Min treasury balance to keep as reserve
const MIN_TREASURY_RESERVE = 100_000_000; // 0.1 SOL

let cachedTreasuryPubkey: string | null = null;

/** GET — returns the treasury public key so the frontend knows the fee payer address */
export async function GET() {
  try {
    if (!cachedTreasuryPubkey) {
      cachedTreasuryPubkey = getTreasuryKeypair().publicKey.toBase58();
    }
    return NextResponse.json({ treasuryPubkey: cachedTreasuryPubkey });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

/** POST — accepts a partially-signed tx (base64), adds treasury signature, sends it */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transaction, walletAddress } = body;

    if (!transaction || !walletAddress) {
      return NextResponse.json(
        { error: "Missing transaction or walletAddress" },
        { status: 400 }
      );
    }

    // Validate wallet address
    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: "Invalid walletAddress" }, { status: 400 });
    }

    // Rate limit per wallet
    const now = Date.now();
    const timestamps = txTimestamps.get(walletAddress) || [];
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Rate limited. Too many sponsored transactions." },
        { status: 429 }
      );
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const treasury = getTreasuryKeypair();

    // Check treasury balance
    const treasuryBalance = await connection.getBalance(treasury.publicKey);
    if (treasuryBalance < MIN_TREASURY_RESERVE) {
      console.error("⚠️ Treasury balance too low:", treasuryBalance / 1e9, "SOL");
      return NextResponse.json(
        { error: "Platform treasury low — please try again later" },
        { status: 503 }
      );
    }

    // Deserialize the partially-signed transaction
    let tx: Transaction;
    try {
      const txBuffer = Buffer.from(transaction, "base64");
      tx = Transaction.from(txBuffer);
    } catch {
      return NextResponse.json({ error: "Invalid transaction data" }, { status: 400 });
    }

    // Verify the fee payer is the treasury
    if (!tx.feePayer || !tx.feePayer.equals(treasury.publicKey)) {
      return NextResponse.json(
        { error: "Transaction fee payer must be the platform treasury" },
        { status: 400 }
      );
    }

    // Add treasury signature
    tx.partialSign(treasury);

    // Send the fully-signed transaction
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    // Update rate limit
    recent.push(now);
    txTimestamps.set(walletAddress, recent);

    console.log(
      `🎟️ Sponsored tx for ${walletAddress.slice(0, 8)}... — sig: ${sig.slice(0, 16)}...`
    );

    return NextResponse.json({ success: true, signature: sig });
  } catch (err: any) {
    console.error("Sponsor tx error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
