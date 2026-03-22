#!/usr/bin/env npx ts-node

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program, Idl, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import idl from "./src/lib/idl.json";

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");

// Helper to convert u64 to little-endian bytes
function toLEBytes(num: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(num), true);
  return new Uint8Array(buffer);
}

// PDA derivation
function getPostPda(author: PublicKey, postId: number): [PublicKey, number] {
  const POST_SEED = Buffer.from("post");
  return PublicKey.findProgramAddressSync(
    [POST_SEED, author.toBuffer(), toLEBytes(postId)],
    PROGRAM_ID
  );
}

function getProfilePda(owner: PublicKey): [PublicKey, number] {
  const PROFILE_SEED = Buffer.from("profile");
  return PublicKey.findProgramAddressSync(
    [PROFILE_SEED, owner.toBuffer()],
    PROGRAM_ID
  );
}

async function testCreatePost() {
  try {
    // Load keypair from deploy folder
    const keypairPath = "./target/deploy/shadowspace-keypair.json";
    if (!fs.existsSync(keypairPath)) {
      console.error("❌ Keypair not found at", keypairPath);
      process.exit(1);
    }

    const secret = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));

    console.log("📝 Testing Post Creation");
    console.log("=======================");
    console.log(`Signer: ${keypair.publicKey.toBase58()}`);

    // Setup connection and provider
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    );
    
    // Create a minimal wallet interface
    const wallet = {
      publicKey: keypair.publicKey,
      signTransaction: async (tx: any) => { 
        tx.partialSign(keypair); 
        return tx; 
      },
      signAllTransactions: async (txs: any[]) => {
        return txs.map(tx => {
          tx.partialSign(keypair);
          return tx;
        });
      }
    };
    
    const provider = new AnchorProvider(connection, wallet as any, { 
      commitment: "confirmed" 
    });

    console.log(`\n🔗 Connected to devnet`);

    // Create program
    const program = new Program(idl as Idl, provider);

    // Test data
    const postId = Date.now();
    const content = `Test post from CLI at ${new Date().toISOString()}`;
    const isPrivate = false;

    console.log(`\nPost Details:`);
    console.log(`  ID: ${postId}`);
    console.log(`  Content: ${content}`);
    console.log(`  Private: ${isPrivate}`);

    // Derive PDAs
    const [postPda] = getPostPda(keypair.publicKey, postId);
    const [profilePda] = getProfilePda(keypair.publicKey);

    console.log(`\nDerived PDAs:`);
    console.log(`  Post: ${postPda.toBase58()}`);
    console.log(`  Profile: ${profilePda.toBase58()}`);

    // Test PDA encoding
    console.log(`\nPDA Seed Encoding Test:`);
    const leBytes = toLEBytes(postId);
    console.log(`  Post ID (${postId}) as LE bytes: ${Buffer.from(leBytes).toString("hex")}`);

    // Check if profile exists
    console.log(`\n📋 Checking profile...`);
    try {
      const profile = await provider.connection.getAccountInfo(profilePda);
      if (profile) {
        console.log(`  ✅ Profile exists`);
      } else {
        console.log(`  ⚠️  Profile not found - need to create it first`);
        console.log(`  Try: npx ts-node create-profile.ts`);
        return;
      }
    } catch (err) {
      console.log(`  ⚠️  Could not fetch profile`);
    }

    // Create post
    console.log(`\n📤 Submitting transaction...`);
    const sig = await program.methods
      .createPost(new BN(postId), content, isPrivate)
      .accounts({
        post: postPda,
        profile: profilePda,
        author: keypair.publicKey,
        systemProgram: new PublicKey("11111111111111111111111111111111"),
      })
      .signers([keypair])
      .rpc();

    console.log(`✅ Post created successfully!`);
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

testCreatePost();
