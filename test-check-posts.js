#!/usr/bin/env node

/**
 * Direct test: Fetch and display actual posts from devnet
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const borsh = require("borsh");

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC_URL = "https://api.devnet.solana.com";

// Simple Post account schema (minimal parsing)
class PostAccount {
  constructor(fields) {
    this.author = fields.author;
    this.postId = fields.postId;
    this.content = fields.content;
    this.isPrivate = fields.isPrivate;
    this.createdAt = fields.createdAt;
  }
}

// Try to parse raw post data
function parsePostData(data) {
  try {
    // Skip first 8 bytes (discriminator)
    const buffer = data.slice(8);
    
    // Manual parsing of Rust struct
    // author (32 bytes pubkey)
    const author = buffer.slice(0, 32);
    
    // postId (u64, 8 bytes)
    const postIdBuffer = buffer.slice(32, 40);
    const postId = BigInt(postIdBuffer.readBigUInt64LE(0));
    
    // content string (4 bytes length + content)
    const contentLenBuffer = buffer.slice(40, 44);
    const contentLen = contentLenBuffer.readUInt32LE(0);
    const content = buffer.slice(44, 44 + contentLen).toString('utf8');
    
    // isPrivate (1 byte bool)
    const isPrivate = buffer[44 + contentLen] === 1;
    
    // createdAt (u64)
    const createdAtBuffer = buffer.slice(45 + contentLen, 53 + contentLen);
    const createdAt = BigInt(createdAtBuffer.readBigUInt64LE(0));
    
    return {
      author: new PublicKey(author).toBase58(),
      postId: postId.toString(),
      content: content.slice(0, 60),
      isPrivate,
      createdAt: createdAt.toString(),
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log("🔍 Fetching and parsing actual posts from devnet...\n");

  const connection = new Connection(RPC_URL);

  try {
    const accounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`✓ Found ${accounts.length} total accounts in program\n`);

    // Filter for posts (usually 589 bytes based on earlier check)
    const postAccounts = accounts.filter(acc => acc.account.data.length >= 400 && acc.account.data.length <= 800);
    console.log(`✓ Filtered to ${postAccounts.length} likely post accounts\n`);

    if (postAccounts.length === 0) {
      console.log("❌ No posts found!");
      return;
    }

    console.log("📋 Posts:");
    console.log("─".repeat(100));

    let publicCount = 0;
    let privateCount = 0;
    const posts = [];

    for (const account of postAccounts) {
      const parsed = parsePostData(account.account.data);
      if (parsed) {
        posts.push(parsed);
        const privacy = parsed.isPrivate ? "🔒 PRIVATE" : "🌐 PUBLIC";
        const author = parsed.author.slice(0, 8) + "...";
        console.log(`${privacy} | Author: ${author} | "${parsed.content}..."`);
        
        if (parsed.isPrivate) privateCount++;
        else publicCount++;
      }
    }

    console.log("─".repeat(100));
    console.log(`\n📊 Summary:`);
    console.log(`  Total posts parsed: ${posts.length}`);
    console.log(`  Public posts: ${publicCount}`);
    console.log(`  Private posts: ${privateCount}\n`);

    if (privateCount > 0) {
      console.log("✅ PRIVATE POSTS ARE BEING CREATED AND MARKED CORRECTLY!\n");
      
      // Group by author
      const byAuthor = {};
      posts.forEach(p => {
        if (!byAuthor[p.author]) byAuthor[p.author] = [];
        byAuthor[p.author].push(p);
      });
      
      console.log("📌 Posts by author:");
      for (const [author, authorPosts] of Object.entries(byAuthor)) {
        const privateNum = authorPosts.filter(p => p.isPrivate).length;
        const publicNum = authorPosts.filter(p => !p.isPrivate).length;
        console.log(`  ${author.slice(0, 8)}... : ${publicNum} public + ${privateNum} private = ${authorPosts.length} total`);
      }
    } else {
      console.log("⚠️  No private posts found. Check if they're being created with isPrivate=true\n");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main().catch(console.error);
