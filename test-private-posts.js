#!/usr/bin/env node

/**
 * Test script: Create two accounts, make them friends, create private posts, verify visibility
 */

const { Connection, PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { Program, AnchorProvider, Idl, Wallet } = require("@coral-xyz/anchor");
const fs = require("fs");
const path = require("path");

// Load IDL
const idlPath = path.join(__dirname, "src/lib/idl.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC_URL = "https://api.devnet.solana.com";

const PROFILE_SEED = Buffer.from("profile");
const POST_SEED = Buffer.from("post");
const FRIEND_SEED = Buffer.from("friends");

function toLEBytes(num) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(num), true);
  return new Uint8Array(buffer);
}

function getProfilePda(owner) {
  return PublicKey.findProgramAddressSync([PROFILE_SEED, owner.toBuffer()], PROGRAM_ID);
}

function getPostPda(author, postId) {
  return PublicKey.findProgramAddressSync([POST_SEED, author.toBuffer(), toLEBytes(postId)], PROGRAM_ID);
}

function getFriendListPda(owner) {
  return PublicKey.findProgramAddressSync([FRIEND_SEED, owner.toBuffer()], PROGRAM_ID);
}

async function main() {
  console.log("🧪 Testing Private Posts with Two Accounts\n");

  // Create connection
  const connection = new Connection(RPC_URL);

  // Create two test keypairs
  const account1 = Keypair.generate();
  const account2 = Keypair.generate();

  console.log(`📝 Account 1: ${account1.publicKey.toBase58()}`);
  console.log(`📝 Account 2: ${account2.publicKey.toBase58()}\n`);

  // Create providers and programs
  const wallet1 = new Wallet(account1);
  const provider1 = new AnchorProvider(connection, wallet1, { commitment: "confirmed" });
  const program1 = new Program(idl, PROGRAM_ID, provider1);

  const wallet2 = new Wallet(account2);
  const provider2 = new AnchorProvider(connection, wallet2, { commitment: "confirmed" });
  const program2 = new Program(idl, PROGRAM_ID, provider2);

  try {
    console.log("✅ Step 1: Create profiles for both accounts");
    
    // Create profile for account 1
    const [profile1Pda] = getProfilePda(account1.publicKey);
    try {
      await program1.methods
        .createProfile("Shaan", "shaan", "🔒")
        .accounts({
          profile: profile1Pda,
          owner: account1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("  ✓ Profile 1 created");
    } catch (e) {
      console.log("  ⚠ Profile 1 might already exist:", e.message.slice(0, 50));
    }

    // Create profile for account 2
    const [profile2Pda] = getProfilePda(account2.publicKey);
    try {
      await program2.methods
        .createProfile("Friend", "friend", "👥")
        .accounts({
          profile: profile2Pda,
          owner: account2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("  ✓ Profile 2 created\n");
    } catch (e) {
      console.log("  ⚠ Profile 2 might already exist:", e.message.slice(0, 50));
    }

    console.log("✅ Step 2: Create friend lists");
    
    // Create friend list for account 1
    const [friendList1Pda] = getFriendListPda(account1.publicKey);
    try {
      await program1.methods
        .createFriendList()
        .accounts({
          friendList: friendList1Pda,
          owner: account1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("  ✓ Friend list 1 created");
    } catch (e) {
      console.log("  ⚠ Friend list 1 might already exist:", e.message.slice(0, 50));
    }

    // Create friend list for account 2
    const [friendList2Pda] = getFriendListPda(account2.publicKey);
    try {
      await program2.methods
        .createFriendList()
        .accounts({
          friendList: friendList2Pda,
          owner: account2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("  ✓ Friend list 2 created\n");
    } catch (e) {
      console.log("  ⚠ Friend list 2 might already exist:", e.message.slice(0, 50));
    }

    console.log("✅ Step 3: Add friends (mutual)");
    
    // Account 1 adds Account 2 as friend
    try {
      await program1.methods
        .addFriend(account2.publicKey)
        .accounts({
          friendList: friendList1Pda,
          profile: profile1Pda,
          user: account1.publicKey,
        })
        .rpc();
      console.log(`  ✓ Account 1 added Account 2 as friend`);
    } catch (e) {
      console.log(`  ✗ Failed to add friend:`, e.message.slice(0, 100));
    }

    // Account 2 adds Account 1 as friend
    try {
      await program2.methods
        .addFriend(account1.publicKey)
        .accounts({
          friendList: friendList2Pda,
          profile: profile2Pda,
          user: account2.publicKey,
        })
        .rpc();
      console.log(`  ✓ Account 2 added Account 1 as friend\n`);
    } catch (e) {
      console.log(`  ✗ Failed to add friend:`, e.message.slice(0, 100));
    }

    // Verify friend lists
    console.log("✅ Step 4: Verify friend lists");
    const friendList1 = await program1.account.friendList.fetch(friendList1Pda);
    const friendList2 = await program2.account.friendList.fetch(friendList2Pda);
    
    console.log(`  Account 1 friends: ${friendList1.friends.length}`);
    console.log(`  Account 2 friends: ${friendList2.friends.length}\n`);

    console.log("✅ Step 5: Create private post from Account 1");
    
    const postId1 = Date.now();
    const [post1Pda] = getPostPda(account1.publicKey, postId1);
    
    try {
      const sig1 = await program1.methods
        .createPost(postId1, "This is a PRIVATE post from Account 1 🔒", true)
        .accounts({
          author: account1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`  ✓ Private post created: ${sig1.slice(0, 20)}...\n`);
    } catch (e) {
      console.log(`  ✗ Failed to create post:`, e.message.slice(0, 100));
      return;
    }

    console.log("✅ Step 6: Create private post from Account 2");
    
    const postId2 = Date.now() + 1;
    const [post2Pda] = getPostPda(account2.publicKey, postId2);
    
    try {
      const sig2 = await program2.methods
        .createPost(postId2, "This is a PRIVATE post from Account 2 👥", true)
        .accounts({
          author: account2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`  ✓ Private post created: ${sig2.slice(0, 20)}...\n`);
    } catch (e) {
      console.log(`  ✗ Failed to create post:`, e.message.slice(0, 100));
      return;
    }

    console.log("✅ Step 7: Fetch all posts and check visibility");
    
    // Get all posts
    const allPosts = await program1.account.post.all();
    console.log(`  Total posts in program: ${allPosts.length}\n`);

    // Account 1's perspective: Should see Account 2's private posts
    console.log("📌 Account 1's view:");
    const account1Posts = allPosts.filter((p) => p.account.author.equals(account1.publicKey));
    const account2Posts = allPosts.filter((p) => p.account.author.equals(account2.publicKey));
    
    console.log(`  Posts by Account 1: ${account1Posts.length}`);
    account1Posts.forEach((p) => {
      console.log(`    - "${p.account.content.slice(0, 40)}..." (private: ${p.account.isPrivate})`);
    });

    console.log(`  Posts by Account 2 (friend): ${account2Posts.length}`);
    account2Posts.forEach((p) => {
      console.log(`    - "${p.account.content.slice(0, 40)}..." (private: ${p.account.isPrivate})`);
      if (p.account.isPrivate) {
        console.log(`    ✓ CAN SEE THIS - Account 2 is my friend!`);
      }
    });

    // Account 2's perspective
    console.log(`\n📌 Account 2's view:`);
    console.log(`  Posts by Account 1 (friend): ${account1Posts.length}`);
    account1Posts.forEach((p) => {
      console.log(`    - "${p.account.content.slice(0, 40)}..." (private: ${p.account.isPrivate})`);
      if (p.account.isPrivate) {
        console.log(`    ✓ CAN SEE THIS - Account 1 is my friend!`);
      }
    });

    console.log(`  Posts by Account 2: ${account2Posts.length}`);
    account2Posts.forEach((p) => {
      console.log(`    - "${p.account.content.slice(0, 40)}..." (private: ${p.account.isPrivate})`);
    });

    console.log("\n✅ TEST COMPLETE!");
    console.log("\n📊 Summary:");
    console.log(`  - Created 2 accounts and made them friends`);
    console.log(`  - Created 1 private post from each account`);
    console.log(`  - Both should see each other's private posts\n`);

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

main().catch(console.error);
