#!/usr/bin/env npx tsx

/**
 * TREASURY WALLET INVESTIGATION
 * Check balance + pull all recent transactions to see where the SOL went
 */
import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from "@solana/web3.js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const TREASURY = new PublicKey("4tpjCdXS1fKiYoBYLvTNNyHwzTAhuigB3TY6Wd2QbxT9");
const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

async function main() {
  const c = new Connection(RPC, "confirmed");

  // ── Current balance ──
  const balance = await c.getBalance(TREASURY);
  console.log("═".repeat(70));
  console.log("  🔍 TREASURY WALLET INVESTIGATION");
  console.log("═".repeat(70));
  console.log(`\n  Wallet:  ${TREASURY.toBase58()}`);
  console.log(`  Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
  console.log(`  💵 ~$${((balance / LAMPORTS_PER_SOL) * 130).toFixed(2)} (@ $130/SOL)\n`);

  // ── Pull transaction signatures ──
  console.log("  📡 Fetching recent transaction signatures...\n");
  const sigs = await c.getSignaturesForAddress(TREASURY, { limit: 100 });

  if (sigs.length === 0) {
    console.log("  No transactions found.");
    return;
  }

  console.log(`  Found ${sigs.length} recent transactions\n`);

  // ── Parse each transaction ──
  let totalSolOut = 0;
  let totalSolIn = 0;
  let txDetails: Array<{
    sig: string;
    time: string;
    type: string;
    solChange: number;
    details: string;
    fee: number;
  }> = [];

  // Fetch parsed transactions one at a time (free tier friendly)
  for (let i = 0; i < sigs.length; i++) {
    const sig = sigs[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 200));
    if (i % 10 === 0) process.stdout.write(`  Processing tx ${i + 1}/${sigs.length}...\r`);
    let tx: ParsedTransactionWithMeta | null = null;
    try {
      tx = await c.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
    } catch (e: any) {
      console.log(`  ⚠️  Failed to fetch tx ${i}: ${e.message?.slice(0, 60)}`);
      continue;
    }
    if (!tx || !tx.meta) continue;
    {

      const time = sig.blockTime
        ? new Date(sig.blockTime * 1000).toISOString().replace("T", " ").slice(0, 19)
        : "unknown";

      const fee = tx.meta.fee;

      // Find treasury's pre/post balance
      const accountKeys = tx.transaction.message.accountKeys.map((k) =>
        typeof k === "string" ? k : k.pubkey.toBase58()
      );
      const treasuryIdx = accountKeys.indexOf(TREASURY.toBase58());

      let solChange = 0;
      if (treasuryIdx !== -1 && tx.meta.preBalances && tx.meta.postBalances) {
        solChange = (tx.meta.postBalances[treasuryIdx] - tx.meta.preBalances[treasuryIdx]) / LAMPORTS_PER_SOL;
      }

      // Determine type
      let type = "unknown";
      let details = "";

      // Check if it's a program instruction
      const instructions = tx.transaction.message.instructions;
      const programIds = instructions.map((ix: any) =>
        typeof ix.programId === "string" ? ix.programId : ix.programId.toBase58()
      );

      if (programIds.includes(PROGRAM_ID.toBase58())) {
        type = "🟢 Shyft Program";
        // Try to decode which instruction
        for (const ix of instructions as any[]) {
          const pid = typeof ix.programId === "string" ? ix.programId : ix.programId.toBase58();
          if (pid === PROGRAM_ID.toBase58() && ix.data) {
            type = "🟢 Shyft Instruction";
          }
        }
      } else if (programIds.includes("11111111111111111111111111111111")) {
        // System program — could be SOL transfer
        for (const ix of instructions as any[]) {
          if ((ix as any).parsed?.type === "transfer") {
            const info = (ix as any).parsed.info;
            if (info.source === TREASURY.toBase58()) {
              type = "🔴 SOL Transfer OUT";
              details = `→ ${info.destination} (${(info.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL)`;
            } else if (info.destination === TREASURY.toBase58()) {
              type = "🟢 SOL Transfer IN";
              details = `← ${info.source} (${(info.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL)`;
            }
          } else if ((ix as any).parsed?.type === "createAccount") {
            type = "📝 Create Account";
            details = `new acct: ${(ix as any).parsed.info.newAccount}`;
          }
        }
      } else if (programIds.includes("BPFLoaderUpgradeab1e11111111111111111111111")) {
        type = "🔧 Program Deploy/Upgrade";
      } else if (programIds.includes("ComputeBudget111111111111111111111111111111")) {
        // Priority fee, check other instructions
        for (const ix of instructions as any[]) {
          const pid = typeof ix.programId === "string" ? ix.programId : ix.programId.toBase58();
          if (pid === PROGRAM_ID.toBase58()) {
            type = "🟢 Shyft (w/ priority fee)";
          }
        }
      }

      // Check inner instructions for transfers
      if (tx.meta.innerInstructions) {
        for (const inner of tx.meta.innerInstructions) {
          for (const iix of inner.instructions as any[]) {
            if (iix.parsed?.type === "transfer" && iix.parsed.info) {
              const info = iix.parsed.info;
              if (info.source === TREASURY.toBase58() && !details.includes("→")) {
                details += ` | inner transfer OUT → ${info.destination} (${(info.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL)`;
              }
              if (info.destination === TREASURY.toBase58() && !details.includes("←")) {
                details += ` | inner transfer IN ← ${info.source} (${(info.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL)`;
              }
            }
          }
        }
      }

      if (solChange < 0) totalSolOut += Math.abs(solChange);
      if (solChange > 0) totalSolIn += solChange;

      txDetails.push({
        sig: sig.signature.slice(0, 20) + "...",
        time,
        type,
        solChange,
        details,
        fee,
      });
    }
  }

  // ── Print results ──
  console.log("  " + "─".repeat(68));
  console.log("  TRANSACTION HISTORY (most recent first)");
  console.log("  " + "─".repeat(68));

  for (const tx of txDetails) {
    const changeStr =
      tx.solChange >= 0
        ? `+${tx.solChange.toFixed(6)} SOL`
        : `${tx.solChange.toFixed(6)} SOL`;
    const color = tx.solChange < 0 ? "🔻" : tx.solChange > 0 ? "🔺" : "➖";
    console.log(`\n  ${color} ${tx.time}  ${changeStr.padStart(16)}   ${tx.type}`);
    console.log(`     Sig: ${tx.sig}   Fee: ${tx.fee} lamports`);
    if (tx.details) {
      console.log(`     ${tx.details}`);
    }
  }

  // ── Summary ──
  console.log("\n" + "═".repeat(70));
  console.log("  📊 SUMMARY");
  console.log("═".repeat(70));
  console.log(`  Total SOL flowed IN:    +${totalSolIn.toFixed(6)} SOL`);
  console.log(`  Total SOL flowed OUT:   -${totalSolOut.toFixed(6)} SOL`);
  console.log(`  Net change:             ${(totalSolIn - totalSolOut).toFixed(6)} SOL`);
  console.log(`  Current balance:         ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

  // ── Group by type ──
  const byType: Record<string, { count: number; solChange: number }> = {};
  for (const tx of txDetails) {
    if (!byType[tx.type]) byType[tx.type] = { count: 0, solChange: 0 };
    byType[tx.type].count++;
    byType[tx.type].solChange += tx.solChange;
  }

  console.log("\n  Breakdown by type:");
  for (const [type, data] of Object.entries(byType).sort((a, b) => a[1].solChange - b[1].solChange)) {
    console.log(`    ${type.padEnd(35)} ${String(data.count).padStart(4)} txs   ${data.solChange.toFixed(6).padStart(12)} SOL`);
  }

  // ── Flag suspicious outbound transfers ──
  const suspicious = txDetails.filter(
    (tx) => tx.type.includes("Transfer OUT") || (tx.solChange < -0.01 && !tx.type.includes("Shyft"))
  );
  if (suspicious.length > 0) {
    console.log("\n  ⚠️  SUSPICIOUS OUTBOUND TRANSFERS:");
    console.log("  " + "─".repeat(68));
    for (const tx of suspicious) {
      console.log(`  ${tx.time}  ${tx.solChange.toFixed(6)} SOL  ${tx.type}`);
      console.log(`     Sig: ${tx.sig}`);
      if (tx.details) console.log(`     ${tx.details}`);
    }
  }

  console.log("\n" + "═".repeat(70));
  console.log("  Full sigs for Solscan/Explorer:");
  console.log("═".repeat(70));
  for (const s of sigs.slice(0, 20)) {
    const time = s.blockTime
      ? new Date(s.blockTime * 1000).toISOString().replace("T", " ").slice(0, 19)
      : "";
    console.log(`  ${time}  https://solscan.io/tx/${s.signature}`);
  }
  console.log("");
}

main().catch(console.error);
