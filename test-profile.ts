#!/usr/bin/env npx tsx

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import * as fs from "fs";
import idl from "./src/lib/idl.json";

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");

// PDA derivation
function getProfilePda(owner: PublicKey): [PublicKey, number] {
  const PROFILE_SEED = Buffer.from("profile");
  return PublicKey.findProgramAddressSync(
    [PROFILE_SEED, owner.toBuffer()],
    PROGRAM_ID
  );
}

async function testCreateProfile() {
  try {
    // Load keypair from deploy folder
    const keypairPath = "./target/deploy/shadowspace-keypair.json";
    if (!fs.existsSync(keypairPath)) {
      console.error("❌ Keypair not found at", keypairPath);
      process.exit(1);
    }

    const secret = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));

    console.log("👤 Testing Profile Creation");
    console.log("===========================");
    console.log(`Owner: ${keypair.publicKey.toBase58()}`);

    // Setup connection and provider - use NodeWallet
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    );
    
    // Use a custom simple wallet
    class SimpleWallet {
      constructor(private payer: Keypair) {}
      
      async signTransaction(tx: any) {
        tx.partialSign(this.payer);
        return tx;
      }
      
      async signAllTransactions(txs: any[]) {
        txs.forEach(tx => tx.partialSign(this.payer));
        return txs;
      }
      
      get publicKey() {
        return this.payer.publicKey;
      }
    }
    
    const provider = new AnchorProvider(
      connection, 
      new SimpleWallet(keypair) as any, 
      { commitment: "confirmed" }
    );

    console.log(`\n🔗 Connected to devnet`);

    // Create program
    const program = new Program(idl as Idl, provider);

    // Derive PDA
    const [profilePda] = getProfilePda(keypair.publicKey);
    console.log(`\nDerived PDA:`);
    console.log(`  Profile: ${profilePda.toBase58()}`);

    // Profile data
    const username = "testuser";
    const displayName = "Test User";
    const bio = "Testing from CLI";

    console.log(`\nProfile Details:`);
    console.log(`  Username: ${username}`);
    console.log(`  Display Name: ${displayName}`);
    console.log(`  Bio: ${bio}`);

    // Create profile using the provider's RPC
    console.log(`\n📤 Submitting transaction...`);
    const sig = await program.methods
      .createProfile(username, displayName, bio)
      .accounts({
        profile: profilePda,
        user: keypair.publicKey,
        systemProgram: PublicKey.default,
      })
      .rpc();

    console.log(`✅ Profile created successfully!`);
    console.log(`\nTransaction: ${sig}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);
    if (err.logs) {
      console.error(`\nProgram Logs:`);
      err.logs.forEach((log: string) => console.error(`  ${log}`));
    }
    console.error(`\nFull Error:`, err);
    process.exit(1);
  }
}

testCreateProfile();
