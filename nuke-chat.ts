import { Program, AnchorProvider, Idl, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const idl = JSON.parse(fs.readFileSync("target/idl/shadowspace.json", "utf-8"));
const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const CHAT_SEED = Buffer.from("chat");
const MESSAGE_SEED = Buffer.from("message");

function toLEBytes(num: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(num));
  return buf;
}

function getChatPda(chatId: number) {
  return PublicKey.findProgramAddressSync([CHAT_SEED, toLEBytes(chatId)], PROGRAM_ID);
}
function getMessagePda(chatId: number, idx: number) {
  return PublicKey.findProgramAddressSync([MESSAGE_SEED, toLEBytes(chatId), toLEBytes(idx)], PROGRAM_ID);
}

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const secret = JSON.parse(fs.readFileSync(path.join(process.env.HOME || "~", ".config/solana/mainnet.json"), "utf-8"));
  const admin = Keypair.fromSecretKey(new Uint8Array(secret));
  const provider = new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" });
  const program = new Program(idl as Idl, provider);

  const chatId = 471563675;
  const msgCount = 10; // Scan up to 10 to be safe

  console.log("Force-closing chat", chatId, "with", msgCount, "messages...\n");

  for (let i = 0; i < msgCount; i++) {
    const [msgPda] = getMessagePda(chatId, i);
    const info = await connection.getAccountInfo(msgPda);
    if (info === null) { console.log(`  msg ${i}: already closed`); continue; }
    try {
      await program.methods.adminForceClose()
        .accounts({ targetAccount: msgPda, authority: admin.publicKey })
        .rpc();
      console.log(`  msg ${i}: ✅ force-closed`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) { console.log(`  msg ${i}: ❌ ${e.message?.slice(0, 80)}`); await new Promise(r => setTimeout(r, 3000)); }
  }

  const [chatPda] = getChatPda(chatId);
  const chatInfo = await connection.getAccountInfo(chatPda);
  if (chatInfo === null) { console.log("\nChat already closed"); return; }
  try {
    await program.methods.adminForceClose()
      .accounts({ targetAccount: chatPda, authority: admin.publicKey })
      .rpc();
    console.log("\n  Chat: ✅ force-closed");
  } catch (e: any) { console.log(`\n  Chat: ❌ ${e.message?.slice(0, 80)}`); }

  console.log("\nDone! Chat fully cleaned up. You can start fresh.");
}

main().catch(console.error);
