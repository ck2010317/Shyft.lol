#!/usr/bin/env npx tsx
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const WALLET = new PublicKey("4tpjCdXS1fKiYoBYLvTNNyHwzTAhuigB3TY6Wd2QbxT9");
const RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

async function main() {
  const c = new Connection(RPC, "confirmed");

  const sigs = await c.getSignaturesForAddress(WALLET, { limit: 50 });

  // Find the suspicious "unknown" txs from ~09:03 timeframe (the -0.018359 ones)
  const suspicious = sigs.filter((s) => {
    if (!s.blockTime) return false;
    const d = new Date(s.blockTime * 1000);
    return d.getUTCHours() <= 10; // earlier txs, not the Shyft ones
  });

  console.log(`Found ${suspicious.length} suspicious txs\n`);

  // Deep inspect first 3
  for (let i = 0; i < Math.min(3, suspicious.length); i++) {
    const s = suspicious[i];
    await new Promise((r) => setTimeout(r, 300));
    const tx = await c.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    if (!tx || !tx.meta) continue;

    const time = s.blockTime
      ? new Date(s.blockTime * 1000).toISOString().replace("T", " ").slice(0, 19)
      : "?";

    console.log("═".repeat(80));
    console.log(`TX #${i + 1}: ${s.signature}`);
    console.log(`Time: ${time}`);
    console.log(
      `Fee payer: ${tx.transaction.message.accountKeys[0].pubkey?.toBase58?.() || tx.transaction.message.accountKeys[0]}`
    );

    console.log("\n📋 Instructions:");
    for (const ix of tx.transaction.message.instructions as any[]) {
      const pid = ix.programId?.toBase58?.() || ix.programId;
      console.log(`  Program: ${pid}`);
      if (ix.parsed) {
        console.log(`    Type: ${ix.parsed.type}`);
        console.log(`    Info: ${JSON.stringify(ix.parsed.info, null, 4)}`);
      } else {
        console.log(`    Data: ${ix.data?.slice(0, 60)}...`);
        const accts = ix.accounts?.map((a: any) => a.toBase58?.() || a) || [];
        console.log(`    Accounts (${accts.length}):`);
        for (const a of accts) {
          console.log(`      ${a}`);
        }
      }
    }

    console.log("\n👥 All signers & accounts:");
    for (const k of tx.transaction.message.accountKeys as any[]) {
      const addr = k.pubkey?.toBase58?.() || k;
      const tags: string[] = [];
      if (k.signer) tags.push("SIGNER");
      if (k.writable) tags.push("WRITABLE");
      console.log(`  ${addr} ${tags.length ? `(${tags.join(", ")})` : ""}`);
    }

    const preB = tx.meta.preBalances.map((b: number) => (b / LAMPORTS_PER_SOL).toFixed(6));
    const postB = tx.meta.postBalances.map((b: number) => (b / LAMPORTS_PER_SOL).toFixed(6));
    console.log("\n💰 Balance changes:");
    for (let j = 0; j < tx.transaction.message.accountKeys.length; j++) {
      const k = tx.transaction.message.accountKeys[j] as any;
      const addr = k.pubkey?.toBase58?.() || k;
      const pre = tx.meta.preBalances[j];
      const post = tx.meta.postBalances[j];
      const diff = post - pre;
      if (diff !== 0) {
        console.log(
          `  ${addr}: ${(pre / LAMPORTS_PER_SOL).toFixed(6)} → ${(post / LAMPORTS_PER_SOL).toFixed(6)} (${diff > 0 ? "+" : ""}${(diff / LAMPORTS_PER_SOL).toFixed(6)} SOL)`
        );
      }
    }

    if (tx.meta.innerInstructions && tx.meta.innerInstructions.length > 0) {
      console.log("\n🔄 Inner instructions:");
      for (const inner of tx.meta.innerInstructions) {
        for (const iix of inner.instructions as any[]) {
          const pid2 = iix.programId?.toBase58?.() || iix.programId;
          console.log(`  Program: ${pid2}`);
          if (iix.parsed) {
            console.log(`    Type: ${iix.parsed.type}`);
            console.log(`    Info: ${JSON.stringify(iix.parsed.info)}`);
          }
        }
      }
    }

    if (tx.meta.logMessages) {
      console.log("\n📝 Log messages:");
      for (const log of tx.meta.logMessages) {
        console.log(`  ${log}`);
      }
    }

    console.log("");
  }

  // Also get total count of ALL sigs (not just 50)
  console.log("═".repeat(80));
  console.log("Fetching total transaction count...");
  let allSigs = sigs;
  let total = sigs.length;
  while (allSigs.length === 50) {
    await new Promise((r) => setTimeout(r, 300));
    const lastSig = allSigs[allSigs.length - 1].signature;
    allSigs = await c.getSignaturesForAddress(WALLET, { limit: 50, before: lastSig });
    total += allSigs.length;
  }
  console.log(`Total transactions on this wallet: ${total}`);
}

main().catch(console.error);
