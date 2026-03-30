/**
 * Close the E2E chat between two users + all messages.
 * Usage: npx tsx close-chat.ts <wallet1> <wallet2>
 */
import { Program, AnchorProvider, Idl, BN, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const idl = JSON.parse(
  fs.readFileSync(path.join(__dirname, "target/idl/shadowspace.json"), "utf-8")
);
const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const DEVNET_URL = "https://api.devnet.solana.com";
const CHAT_SEED = Buffer.from("chat");
const MESSAGE_SEED = Buffer.from("message");

function toLEBytes(num: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(num), true);
  return new Uint8Array(buffer);
}

function getChatPda(chatId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CHAT_SEED, Buffer.from(toLEBytes(chatId))],
    PROGRAM_ID
  );
}

function getMessagePda(chatId: number, messageIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MESSAGE_SEED, Buffer.from(toLEBytes(chatId)), Buffer.from(toLEBytes(messageIndex))],
    PROGRAM_ID
  );
}

function deriveChatId(user1: PublicKey, user2: PublicKey): number {
  const sorted = [user1.toBase58(), user2.toBase58()].sort();
  let hash = 0;
  const str = sorted[0] + sorted[1];
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

async function main() {
  const wallet1 = process.argv[2];
  const wallet2 = process.argv[3];

  if (!wallet1 || !wallet2) {
    console.log("Usage: npx tsx close-chat.ts <wallet1_address> <wallet2_address>");
    console.log("\nWill search for chat between these two wallets and close it + all messages.");
    
    // If no args, scan for all chats
    console.log("\nScanning for all chats on program...");
    const connection = new Connection(DEVNET_URL, "confirmed");
    const adminKeyPath = path.join(process.env.HOME || "~", ".config/solana/mainnet.json");
    const adminSecret = JSON.parse(fs.readFileSync(adminKeyPath, "utf-8"));
    const admin = Keypair.fromSecretKey(new Uint8Array(adminSecret));
    const provider = new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" });
    const program = new Program(idl as Idl, provider);
    
    const allChats = await program.account.chat.all();
    console.log(`\nFound ${allChats.length} chat(s):\n`);
    for (const chat of allChats) {
      const c = chat.account as any;
      console.log(`  Chat PDA: ${chat.publicKey.toBase58()}`);
      console.log(`    chatId: ${c.chatId?.toString()}`);
      console.log(`    user1: ${c.user1?.toBase58()}`);
      console.log(`    user2: ${c.user2?.toBase58()}`);
      console.log(`    messageCount: ${c.messageCount?.toString()}`);
      console.log();
    }
    return;
  }

  const pub1 = new PublicKey(wallet1);
  const pub2 = new PublicKey(wallet2);
  const chatId = deriveChatId(pub1, pub2);
  const [chatPda] = getChatPda(chatId);

  console.log(`Chat ID: ${chatId}`);
  console.log(`Chat PDA: ${chatPda.toBase58()}`);

  const connection = new Connection(DEVNET_URL, "confirmed");
  
  // Load admin wallet
  const adminKeyPath = path.join(process.env.HOME || "~", ".config/solana/mainnet.json");
  const adminSecret = JSON.parse(fs.readFileSync(adminKeyPath, "utf-8"));
  const admin = Keypair.fromSecretKey(new Uint8Array(adminSecret));
  
  const provider = new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" });
  const program = new Program(idl as Idl, provider);

  // Check if chat exists
  const chatInfo = await connection.getAccountInfo(chatPda);
  if (!chatInfo) {
    console.log("Chat does not exist on-chain.");
    return;
  }

  // Fetch chat to get message count
  const chat = await program.account.chat.fetch(chatPda);
  const msgCount = Number((chat as any).messageCount || 0);
  const user1Addr = (chat as any).user1?.toBase58();
  
  console.log(`User1: ${user1Addr}`);
  console.log(`User2: ${(chat as any).user2?.toBase58()}`);
  console.log(`Messages: ${msgCount}`);

  // Close all messages first (must be done by sender or user1)
  for (let i = 0; i < msgCount; i++) {
    const [msgPda] = getMessagePda(chatId, i);
    const msgInfo = await connection.getAccountInfo(msgPda);
    if (!msgInfo) {
      console.log(`  Message ${i}: already closed`);
      continue;
    }
    
    try {
      // Try closing as admin (who is likely user1 — if not, this will fail)
      // The close_message instruction requires the user to be the sender
      // We need to check who the sender is
      const msg = await program.account.message.fetch(msgPda);
      const sender = (msg as any).sender?.toBase58();
      console.log(`  Message ${i}: sender=${sender?.slice(0, 8)}... — attempting close...`);
      
      // close_message requires user = sender of the message
      // Since we're admin and may not be sender, we need a different approach
      // The program's close_message has constraint: user = message.sender
      // So we can only close if admin is the sender
      
      if (sender === admin.publicKey.toBase58()) {
        await program.methods
          .closeMessage(new BN(chatId), new BN(i))
          .accounts({ message: msgPda, user: admin.publicKey })
          .rpc();
        console.log(`    ✅ Closed`);
      } else {
        console.log(`    ⚠️ Cannot close (sender is not admin)`);
      }
    } catch (err: any) {
      console.log(`    ❌ Failed: ${err?.message?.slice(0, 80)}`);
    }
  }

  // Close the chat (must be done by user1 or user2)
  try {
    console.log(`\nClosing chat...`);
    // chat close constraint: user = chat.user1 OR user = chat.user2
    if (user1Addr === admin.publicKey.toBase58() || (chat as any).user2?.toBase58() === admin.publicKey.toBase58()) {
      await program.methods
        .closeChat(new BN(chatId))
        .accounts({ chat: chatPda, user: admin.publicKey })
        .rpc();
      console.log("✅ Chat closed!");
    } else {
      console.log("⚠️ Admin is not user1 or user2 — cannot close chat directly.");
      console.log("   You need to use one of the participant wallets.");
      console.log(`   user1: ${user1Addr}`);
      console.log(`   user2: ${(chat as any).user2?.toBase58()}`);
    }
  } catch (err: any) {
    console.log(`❌ Failed to close chat: ${err?.message?.slice(0, 120)}`);
  }
}

main().catch(console.error);
