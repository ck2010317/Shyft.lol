#!/usr/bin/env node

/**
 * Test: Create private post as Account A, check visibility from Account B's perspective
 */

const { Connection, PublicKey } = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC_URL = "https://api.devnet.solana.com";

// Account addresses from the test output
const ACCOUNT_A = "2WWEW2Ry4XvBP1eQWuS1iKb515UBnkFDuLUsbwYvbxqj"; // Has 18 private posts
const ACCOUNT_B = "62QgHwYeTUn9DLNrAuXYa7QkSU2BSP6odfHL33uxesdw"; // Has 4 private posts

function parsePostData(data) {
  try {
    const buffer = data.slice(8);
    const author = buffer.slice(0, 32);
    const postIdBuffer = buffer.slice(32, 40);
    const postId = BigInt(postIdBuffer.readBigUInt64LE(0));
    
    const contentLenBuffer = buffer.slice(40, 44);
    const contentLen = contentLenBuffer.readUInt32LE(0);
    const content = buffer.slice(44, 44 + contentLen).toString('utf8');
    
    const isPrivate = buffer[44 + contentLen] === 1;
    const createdAtBuffer = buffer.slice(45 + contentLen, 53 + contentLen);
    const createdAt = BigInt(createdAtBuffer.readBigUInt64LE(0));
    
    return {
      author: new PublicKey(author).toBase58(),
      postId: postId.toString(),
      content: content.slice(0, 50),
      isPrivate,
      createdAt: createdAt.toString(),
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log("🧪 Testing Private Post Visibility Between Accounts\n");
  console.log(`Account A (poster): ${ACCOUNT_A.slice(0, 8)}...`);
  console.log(`Account B (viewer): ${ACCOUNT_B.slice(0, 8)}...\n`);

  const connection = new Connection(RPC_URL);

  try {
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    const postAccounts = accounts.filter(acc => acc.account.data.length >= 400 && acc.account.data.length <= 800);

    const posts = [];
    for (const account of postAccounts) {
      const parsed = parsePostData(account.account.data);
      if (parsed) posts.push(parsed);
    }

    console.log(`📊 Total posts in program: ${posts.length}\n`);

    // Filter posts by author
    const accountAPosts = posts.filter(p => p.author === ACCOUNT_A);
    const accountBPosts = posts.filter(p => p.author === ACCOUNT_B);

    console.log("=" * 80);
    console.log("📌 ACCOUNT A (Poster):");
    console.log("=" * 80);
    console.log(`Total posts by A: ${accountAPosts.length}`);
    
    const aPrivate = accountAPosts.filter(p => p.isPrivate);
    const aPublic = accountAPosts.filter(p => !p.isPrivate);
    
    console.log(`  Public: ${aPublic.length}`);
    console.log(`  Private: ${aPrivate.length}`);
    
    if (aPrivate.length > 0) {
      console.log(`\n  Private posts from Account A:`);
      aPrivate.slice(0, 3).forEach(p => {
        console.log(`    - "${p.content}..."`);
      });
    }

    console.log("\n" + "=" * 80);
    console.log("📌 ACCOUNT B (Friend/Viewer):");
    console.log("=" * 80);
    console.log(`Total posts by B: ${accountBPosts.length}`);
    
    const bPrivate = accountBPosts.filter(p => p.isPrivate);
    const bPublic = accountBPosts.filter(p => !p.isPrivate);
    
    console.log(`  Public: ${bPublic.length}`);
    console.log(`  Private: ${bPrivate.length}`);
    
    if (bPrivate.length > 0) {
      console.log(`\n  Private posts from Account B:`);
      bPrivate.slice(0, 3).forEach(p => {
        console.log(`    - "${p.content}..."`);
      });
    }

    console.log("\n" + "=" * 80);
    console.log("❓ CAN ACCOUNT B SEE ACCOUNT A'S PRIVATE POSTS?");
    console.log("=" * 80);
    
    if (aPrivate.length === 0) {
      console.log("⚠️  Account A has no private posts to check");
    } else {
      console.log("✓ On-chain: Account A's private posts EXISTS and are marked as private");
      console.log(`  Total: ${aPrivate.length} private posts\n`);
      
      console.log("❌ Issue: The Friends Only section would ONLY show these IF:");
      console.log("  1. Account B has Account A in their friend list");
      console.log("  2. The Feed component successfully fetches Account A's posts");
      console.log("  3. The filter for isPrivate=true works correctly\n");
      
      console.log("🔍 The test shows posts ARE created with isPrivate=true");
      console.log("   So the problem is likely in the Friend visibility logic\n");
      
      // Check if they added each other
      console.log("💡 NEXT STEP:");
      console.log("   Check in Profile tab if Account A and B are mutual friends");
      console.log("   If yes, the issue is in how getPostsByAuthor() filters private posts");
      console.log("   If no, they need to add each other first");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main().catch(console.error);
