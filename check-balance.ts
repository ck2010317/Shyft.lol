#!/usr/bin/env npx tsx

import { Connection, PublicKey } from "@solana/web3.js";

async function checkBalance() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const key = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
  const balance = await conn.getBalance(key);
  console.log(`Wallet Balance: ${balance / 1000000000} SOL`);
  
  if (balance === 0) {
    console.log("\n⚠️  Wallet has NO SOL! Get testnet SOL from: https://faucet.solana.com");
  } else {
    console.log("✅ Wallet has funds");
  }
}

checkBalance().catch(e => console.error("Error:", e.message));
