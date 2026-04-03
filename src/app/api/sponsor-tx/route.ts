import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";

/**
 * /api/sponsor-tx — Treasury signs as fee payer for user transactions.
 *
 * SECURITY LAYERS:
 * 1. Origin check — only shyft.lol (no empty origin fallback)
 * 2. IP-based rate limiting — 5 tx per IP per minute
 * 3. Wallet-based rate limiting — 5 tx per wallet per minute
 * 4. walletAddress MUST be a signer on the tx
 * 5. ONLY Shadowspace + SystemProgram + ComputeBudget allowed
 * 6. Every tx MUST include at least one Shadowspace instruction
 * 7. Treasury must NOT be source on ANY SystemProgram instruction
 * 8. Max 6 instructions per tx
 * 9. Treasury balance reserve check
 */

const SHADOWSPACE_PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");

// MINIMAL allowed programs — only what Shadowspace needs
const ALLOWED_PROGRAMS = new Set([
  SHADOWSPACE_PROGRAM_ID.toBase58(),
  SystemProgram.programId.toBase58(),
  "ComputeBudget111111111111111111111111111111",
]);

function getTreasuryKeypair(): Keypair {
  const secret = process.env.TREASURY_PRIVATE_KEY;
  if (!secret) throw new Error("TREASURY_PRIVATE_KEY not set");
  // Support both formats: JSON byte array [12,45,...] or base58 string (Phantom export)
  if (secret.trimStart().startsWith("[")) {
    const bytes = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(new Uint8Array(bytes));
  }
  // base58 string — decode manually
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const str = secret.trim();
  const bytes: number[] = [0];
  for (const char of str) {
    let carry = ALPHABET.indexOf(char);
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let i = 0; i < str.length && str[i] === "1"; i++) bytes.push(0);
  return Keypair.fromSecretKey(new Uint8Array(bytes.reverse()));
}

// Shadowspace on-chain program is on mainnet
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY_PRIVATE}`;

// Rate limiting — per IP AND per wallet, 5 per minute each
const ipTimestamps = new Map<string, number[]>();
const walletTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

// Min treasury balance to keep as reserve
const MIN_TREASURY_RESERVE = 100_000_000; // 0.1 SOL

let cachedTreasuryPubkey: string | null = null;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(key: string, store: Map<string, number[]>): boolean {
  const now = Date.now();
  const timestamps = (store.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  store.set(key, timestamps);
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  store.set(key, timestamps);
  return false;
}

/** GET — returns the treasury public key */
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

// Allowed origins — STRICT. No empty origin fallback.
const ALLOWED_ORIGINS = new Set([
  "https://www.shyft.lol",
  "https://shyft.lol",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3099",
]);

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin") || "";
  const referer = request.headers.get("referer") || "";
  if (origin && ALLOWED_ORIGINS.has(origin)) return true;
  for (const allowed of ALLOWED_ORIGINS) {
    if (referer.startsWith(allowed)) return true;
  }
  // NO FALLBACK — if both origin and referer are missing/invalid, DENY.
  return false;
}

/** POST — accepts a partially-signed tx (base64), adds treasury signature, sends it */
export async function POST(request: NextRequest) {
  try {
    // ── 1. ORIGIN CHECK (strict — no empty fallback) ──
    if (!isAllowedOrigin(request)) {
      console.error(`🚨 BLOCKED origin: ${request.headers.get("origin")} | ref: ${request.headers.get("referer")}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { transaction, walletAddress } = body;
    if (!transaction || !walletAddress) {
      return NextResponse.json({ error: "Missing transaction or walletAddress" }, { status: 400 });
    }

    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: "Invalid walletAddress" }, { status: 400 });
    }

    // ── 2. RATE LIMIT — by IP AND wallet ──
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp, ipTimestamps)) {
      console.error(`🚨 IP rate limited: ${clientIp}`);
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    if (isRateLimited(walletAddress, walletTimestamps)) {
      console.error(`🚨 Wallet rate limited: ${walletAddress}`);
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const treasury = getTreasuryKeypair();

    // ── 3. TREASURY BALANCE CHECK ──
    const treasuryBalance = await connection.getBalance(treasury.publicKey);
    if (treasuryBalance < MIN_TREASURY_RESERVE) {
      console.error("⚠️ Treasury low:", treasuryBalance / 1e9, "SOL");
      return NextResponse.json({ error: "Platform treasury low" }, { status: 503 });
    }

    // ── 4. DESERIALIZE TX ──
    let tx: Transaction;
    try {
      tx = Transaction.from(Buffer.from(transaction, "base64"));
    } catch {
      return NextResponse.json({ error: "Invalid transaction data" }, { status: 400 });
    }

    // ── 5. VERIFY FEE PAYER IS TREASURY ──
    if (!tx.feePayer || !tx.feePayer.equals(treasury.publicKey)) {
      return NextResponse.json({ error: "Fee payer must be treasury" }, { status: 400 });
    }

    // ── 6. VERIFY walletAddress IS A SIGNER ON THE TX ──
    const txSigners = tx.signatures
      .filter((s) => s.signature !== null || s.publicKey.equals(walletPubkey))
      .map((s) => s.publicKey.toBase58());
    if (!txSigners.includes(walletAddress)) {
      console.error(`🚨 BLOCKED: walletAddress ${walletAddress} is not a signer on the tx`);
      return NextResponse.json({ error: "Wallet must be a signer" }, { status: 403 });
    }

    // ── 7. INSTRUCTION LIMIT ──
    if (tx.instructions.length > 6) {
      return NextResponse.json({ error: "Too many instructions" }, { status: 400 });
    }

    // ── 7b. BLOCK HIGH PRIORITY FEES ──
    // Attacker can set insane ComputeUnitPrice to drain treasury via tx fees.
    // ComputeBudget SetComputeUnitPrice has type byte = 3.
    // ComputeBudget SetComputeUnitLimit has type byte = 2.
    const COMPUTE_BUDGET_ID = "ComputeBudget111111111111111111111111111111";
    const MAX_COMPUTE_UNIT_PRICE = 100_000; // 0.0001 SOL per CU — more than enough for priority
    const MAX_COMPUTE_UNITS = 400_000; // standard limit
    for (const ix of tx.instructions) {
      if (ix.programId.toBase58() === COMPUTE_BUDGET_ID && ix.data.length >= 1) {
        const ixType = ix.data[0];
        if (ixType === 3 && ix.data.length >= 9) {
          // SetComputeUnitPrice — 8-byte LE u64 at offset 1
          const price = ix.data.readBigUInt64LE(1);
          if (price > BigInt(MAX_COMPUTE_UNIT_PRICE)) {
            console.error(`🚨 BLOCKED: ComputeUnitPrice ${price} from ${walletAddress}`);
            return NextResponse.json({ error: "Compute unit price too high" }, { status: 403 });
          }
        }
        if (ixType === 2 && ix.data.length >= 5) {
          // SetComputeUnitLimit — 4-byte LE u32 at offset 1
          const units = ix.data.readUInt32LE(1);
          if (units > MAX_COMPUTE_UNITS) {
            console.error(`🚨 BLOCKED: ComputeUnitLimit ${units} from ${walletAddress}`);
            return NextResponse.json({ error: "Compute unit limit too high" }, { status: 403 });
          }
        }
      }
    }

    // ── 8. VALIDATE ALL PROGRAMS ──
    const allProgramIds = tx.instructions.map((ix: any) => ix.programId.toBase58());
    for (const ix of tx.instructions) {
      const programId = ix.programId.toBase58();
      if (!ALLOWED_PROGRAMS.has(programId)) {
        console.error(`🚨 BLOCKED program: ${programId} from ${walletAddress}`);
        return NextResponse.json({ error: "Unauthorized program" }, { status: 403 });
      }
    }

    // ── 9. MUST HAVE AT LEAST ONE SHADOWSPACE INSTRUCTION ──
    const hasShadowspace = tx.instructions.some(
      (ix: any) => ix.programId.toBase58() === SHADOWSPACE_PROGRAM_ID.toBase58()
    );
    if (!hasShadowspace) {
      console.error(`🚨 BLOCKED: No Shadowspace instruction from ${walletAddress}`);
      return NextResponse.json({ error: "Must include Shadowspace instruction" }, { status: 403 });
    }

    // ── 10. BLOCK ALL SYSTEMPROG INSTRUCTIONS WHERE TREASURY IS SOURCE ──
    // Types: 0=CreateAccount, 2=Transfer, 3=CreateAccountWithSeed, 12=TransferWithSeed
    // ALL of these transfer lamports from the first account (source).
    // We block ANY SystemProgram instruction where treasury is a writable signer.
    for (const ix of tx.instructions) {
      if (ix.programId.equals(SystemProgram.programId)) {
        // Check if treasury is the FIRST key (source/funder) on any SystemProgram ix
        const firstKey = ix.keys[0];
        if (firstKey && firstKey.pubkey.equals(treasury.publicKey) && firstKey.isWritable) {
          const ixType = ix.data.length >= 4 ? ix.data.readUInt32LE(0) : -1;
          console.error(`🚨 BLOCKED: SystemProgram type ${ixType} with treasury as source from ${walletAddress}`);
          return NextResponse.json({ error: "Treasury cannot be source on SystemProgram" }, { status: 403 });
        }
      }
    }

    // ── 11. SIMULATE TX — detect CPI rent drain ──
    // Anchor's init_if_needed does an inner CPI to SystemProgram::CreateAccount
    // with treasury as payer. This is invisible to our top-level instruction checks.
    // Simulation catches this: if treasury loses more than the tx fee, REJECT.
    tx.partialSign(treasury);
    try {
      const simResult = await connection.simulateTransaction(tx);
      if (simResult.value.err) {
        console.error(`🚨 Simulation failed for ${walletAddress}:`, JSON.stringify(simResult.value.err));
        return NextResponse.json({ error: "Transaction simulation failed" }, { status: 400 });
      }

      // Check treasury balance change via pre/post balances
      const accountKeys = tx.compileMessage().accountKeys.map((k) => k.toBase58());
      const treasuryIdx = accountKeys.indexOf(treasury.publicKey.toBase58());
      if (treasuryIdx !== -1 && simResult.value.accounts) {
        const postAccount = simResult.value.accounts[treasuryIdx];
        if (postAccount) {
          const postBalance = postAccount.lamports;
          const balanceDrop = treasuryBalance - postBalance;
          // Allow up to 0.01 SOL per tx for rent + fees (normal creates cost ~0.005 SOL)
          // Single account create: ~0.005 SOL rent + 0.000005 fee
          // Double (e.g. create_chat + send_message): ~0.01 SOL
          const MAX_ALLOWED_DROP = 15_000_000; // 0.015 SOL — generous for 2-3 accounts per tx
          if (balanceDrop > MAX_ALLOWED_DROP) {
            console.error(`🚨 BLOCKED: Treasury would lose ${balanceDrop / 1e9} SOL (max ${MAX_ALLOWED_DROP / 1e9}) from ${walletAddress}`);
            return NextResponse.json({ error: "Transaction would drain treasury" }, { status: 403 });
          }
        }
      }
    } catch (simErr: any) {
      console.error(`⚠️ Simulation error for ${walletAddress}:`, simErr?.message);
      // On simulation failure, block to be safe
      return NextResponse.json({ error: "Transaction simulation error" }, { status: 400 });
    }

    // ── 12. SEND (already signed) ──
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");

    console.log(`🎟️ Sponsored: ${walletAddress.slice(0, 8)}.. | ${sig.slice(0, 16)}.. | IP: ${clientIp}`);
    return NextResponse.json({ success: true, signature: sig });
  } catch (err: any) {
    console.error("Sponsor tx error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
