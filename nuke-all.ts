/**
 * nuke-all.ts — Close ALL program accounts on devnet.
 * 
 * Uses getProgramAccounts to find every account owned by the program,
 * then calls admin_force_close on each one. Rent SOL goes back to admin.
 * 
 * Usage: npx ts-node --esm nuke-all.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const ADMIN_AUTHORITY = new PublicKey("8wf9jJrsUPtCrWwzXxXMkEQSWX2A4sSNAVRSNjuty4j");
const RPC_URL = "https://api.devnet.solana.com";

// Anchor discriminator for admin_force_close = sha256("global:admin_force_close")[0..8]
// We compute it manually
import { createHash } from "crypto";
const disc = createHash("sha256").update("global:admin_force_close").digest().slice(0, 8);

async function main() {
  // Load admin keypair
  const keypairPath = path.join(process.env.HOME!, ".config/solana/mainnet.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const admin = Keypair.fromSecretKey(new Uint8Array(secretKey));
  
  if (!admin.publicKey.equals(ADMIN_AUTHORITY)) {
    console.error("❌ Loaded keypair doesn't match ADMIN_AUTHORITY");
    console.error("   Got:", admin.publicKey.toBase58());
    console.error("   Expected:", ADMIN_AUTHORITY.toBase58());
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, "confirmed");

  console.log("🔍 Finding all program accounts...");
  console.log("   Program:", PROGRAM_ID.toBase58());
  console.log("   Admin:", admin.publicKey.toBase58());

  const adminBalanceBefore = await connection.getBalance(admin.publicKey);
  console.log("   Admin balance:", (adminBalanceBefore / 1e9).toFixed(4), "SOL");

  // Get ALL accounts owned by our program
  const accounts = await connection.getProgramAccounts(PROGRAM_ID);
  console.log(`\n📦 Found ${accounts.length} program accounts\n`);

  if (accounts.length === 0) {
    console.log("✅ No accounts to close — already clean!");
    return;
  }

  // List them
  for (const { pubkey, account } of accounts) {
    console.log(`  ${pubkey.toBase58()} — ${account.data.length} bytes, ${(account.lamports / 1e9).toFixed(6)} SOL`);
  }

  // Close them in batches (max ~5 per tx to stay under size limits)
  const BATCH_SIZE = 5;
  let closed = 0;
  let totalReclaimed = 0;

  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const tx = new Transaction();

    for (const { pubkey, account } of batch) {
      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: pubkey, isSigner: false, isWritable: true },
          { pubkey: admin.publicKey, isSigner: true, isWritable: true },
        ],
        data: Buffer.from(disc),
      });
      tx.add(ix);
      totalReclaimed += account.lamports;
    }

    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(admin);

    try {
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      closed += batch.length;
      console.log(`\n✅ Closed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} accounts (tx: ${sig.slice(0, 20)}...)`);
    } catch (err: any) {
      console.error(`\n❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err?.message?.slice(0, 120));
      // Try individually
      for (const { pubkey, account } of batch) {
        const singleTx = new Transaction();
        const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: pubkey, isSigner: false, isWritable: true },
            { pubkey: admin.publicKey, isSigner: true, isWritable: true },
          ],
          data: Buffer.from(disc),
        });
        singleTx.add(ix);
        singleTx.feePayer = admin.publicKey;
        singleTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        singleTx.sign(admin);
        
        try {
          const sig = await connection.sendRawTransaction(singleTx.serialize());
          await connection.confirmTransaction(sig, "confirmed");
          closed++;
          console.log(`  ✅ Closed ${pubkey.toBase58().slice(0, 12)}... (${(account.lamports / 1e9).toFixed(6)} SOL reclaimed)`);
        } catch (e: any) {
          console.error(`  ❌ Failed to close ${pubkey.toBase58().slice(0, 12)}...:`, e?.message?.slice(0, 80));
        }
      }
    }
  }

  const adminBalanceAfter = await connection.getBalance(admin.publicKey);
  const netRecovered = (adminBalanceAfter - adminBalanceBefore) / 1e9;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`🧹 NUKE COMPLETE`);
  console.log(`   Accounts closed: ${closed}/${accounts.length}`);
  console.log(`   Rent reclaimed: ~${(totalReclaimed / 1e9).toFixed(6)} SOL`);
  console.log(`   Net balance change: ${netRecovered >= 0 ? "+" : ""}${netRecovered.toFixed(6)} SOL`);
  console.log(`   Admin balance: ${(adminBalanceAfter / 1e9).toFixed(4)} SOL`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
