import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder } from "@coral-xyz/anchor";
import idl from "./src/lib/idl.json";
// @ts-ignore
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const conn = new Connection(process.env.HELIUS_DEVNET_RPC || "https://api.devnet.solana.com", "confirmed");
const coder = new BorshCoder(idl as any);
const CHAT_SEED = Buffer.from("chat");
const MSG_SEED = Buffer.from("message");
function toLEBytes(n: number) { const b = new ArrayBuffer(8); new DataView(b).setBigUint64(0, BigInt(n), true); return new Uint8Array(b); }

async function scanChat(chatId: number, label: string) {
  console.log("\n=== " + label + " (chatId=" + chatId + ") ===");
  const [chatPda] = PublicKey.findProgramAddressSync([CHAT_SEED, toLEBytes(chatId)], PROGRAM_ID);
  const chatAcc = await conn.getAccountInfo(chatPda, "confirmed");
  if (!chatAcc) { console.log("  Chat PDA does not exist!"); return; }
  try {
    const cd = coder.accounts.decode("Chat", chatAcc.data) as any;
    console.log("  user1:", cd.user1?.toBase58());
    console.log("  user2:", cd.user2?.toBase58());
  } catch(e) { console.log("  decode error:", e); }

  for (let i = 0; i < 10; i++) {
    const [pda] = PublicKey.findProgramAddressSync([MSG_SEED, toLEBytes(chatId), toLEBytes(i)], PROGRAM_ID);
    const acc = await conn.getAccountInfo(pda, "confirmed");
    if (!acc) { console.log("  msg[" + i + "]: --empty--"); if (i > 3) break; continue; }
    try {
      const m = coder.accounts.decode("Message", acc.data) as any;
      console.log("  msg[" + i + "]: sender=" + m.sender?.toBase58().slice(0,12) + "... content=" + (m.content||"").slice(0,50));
    } catch(e) { console.log("  msg[" + i + "]: decode error"); }
  }
}

async function main() {
  await scanChat(682333175, "Gk5s <-> G8iDMHSp");
  await scanChat(471563675, "2DT7 <-> Gk5s");
}
main();
