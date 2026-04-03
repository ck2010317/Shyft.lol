/**
 * Comprehensive rent check — accounts + program executable + programdata
 */
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

async function main() {
  const c = new Connection(RPC, "confirmed");

  // Correct sizes from lib.rs: 8-byte Anchor discriminator + struct LEN
  const sizeToType: Record<number, string> = {
    443: "Profile",
    569: "Post",
    192: "Comment",
    73: "Reaction",
    72: "Follow",
    96: "Chat",
    589: "Message",
    360: "Community",
    80: "Membership",
    // old schema sizes (pre-optimization accounts still on chain)
    315: "Profile (old v1)",
    269: "Post (old v1)",
    429: "Profile (old v2)",
    577: "Post (old v2)",
    232: "Comment (old)",
    81: "Reaction (old)",
  };

  console.log("═".repeat(62));
  console.log("  SHYFT.LOL — FULL RENT AUDIT (MAINNET)");
  console.log("═".repeat(62));
  console.log("\n📡 Fetching all program-owned accounts...");

  const fullAccounts = await c.getProgramAccounts(PROGRAM_ID);

  const categories: Record<string, { count: number; totalRent: number; size: number }> = {};
  let accountsRent = 0;
  let totalAccounts = 0;

  for (const acct of fullAccounts) {
    const size = acct.account.data.length;
    const rent = acct.account.lamports;
    const type = sizeToType[size] || `Unknown (${size}b)`;
    if (!categories[type]) categories[type] = { count: 0, totalRent: 0, size };
    categories[type].count++;
    categories[type].totalRent += rent;
    accountsRent += rent;
    totalAccounts++;
  }

  const sorted = Object.entries(categories).sort((a, b) => b[1].totalRent - a[1].totalRent);

  console.log(`   Found ${totalAccounts} data accounts\n`);
  console.log("  Type                       Count    Rent (SOL)       Size");
  console.log("  " + "─".repeat(60));
  for (const [type, data] of sorted) {
    const sol = (data.totalRent / LAMPORTS_PER_SOL).toFixed(6);
    console.log(
      "  " +
        type.padEnd(27) +
        String(data.count).padStart(5) +
        "    " +
        sol.padStart(12) +
        " SOL    " +
        data.size +
        "b"
    );
  }
  console.log("  " + "─".repeat(60));
  console.log(
    "  Data accounts total".padEnd(29) +
      String(totalAccounts).padStart(5) +
      "    " +
      (accountsRent / LAMPORTS_PER_SOL).toFixed(6).padStart(12) +
      " SOL"
  );

  // ── Program executable ──
  let grandTotal = accountsRent;
  console.log("\n📋 Program infrastructure:");

  const programInfo = await c.getAccountInfo(PROGRAM_ID);
  if (programInfo) {
    console.log(
      `  Program executable:        ${(programInfo.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL  (${programInfo.data.length}b)`
    );
    grandTotal += programInfo.lamports;

    // BPFUpgradeableLoader stores programdata address at bytes 4..36
    if (programInfo.data.length >= 36) {
      const programdataAddress = new PublicKey(programInfo.data.slice(4, 36));
      const programdata = await c.getAccountInfo(programdataAddress);
      if (programdata) {
        console.log(
          `  Program data (bytecode):   ${(programdata.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL  (${programdata.data.length}b)`
        );
        grandTotal += programdata.lamports;
      }
    }
  }

  // IDL account (Anchor stores at PDA)
  try {
    const [idlPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor:idl"), PROGRAM_ID.toBuffer()],
      new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
    );
    const idlAcct = await c.getAccountInfo(idlPda);
    if (idlAcct) {
      console.log(
        `  IDL account:               ${(idlAcct.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL  (${idlAcct.data.length}b)`
      );
      grandTotal += idlAcct.lamports;
    }
  } catch {}

  // Treasury / authority wallet balance
  const TREASURY = new PublicKey("8wf9jJrsUPtCrWwzXxXMkEQSWX2A4sSNAVRSNjuty4j");
  try {
    const treasuryBal = await c.getBalance(TREASURY);
    console.log(
      `\n  💰 Treasury/authority wallet: ${(treasuryBal / LAMPORTS_PER_SOL).toFixed(6)} SOL`
    );
  } catch {}

  console.log("\n" + "═".repeat(62));
  console.log(
    `  GRAND TOTAL RENT LOCKED:   ${(grandTotal / LAMPORTS_PER_SOL).toFixed(6)} SOL`
  );
  const price = 130;
  console.log(`  💵 At $${price}/SOL:              $${((grandTotal / LAMPORTS_PER_SOL) * price).toFixed(2)}`);
  console.log("═".repeat(62));
  console.log("  Data account rent is refundable if accounts are closed.");
  console.log("  Program/programdata rent is refundable if program is closed.\n");
}

main().catch(console.error);
