import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder } from "@coral-xyz/anchor";
import idl from "./src/lib/idl.json";
// @ts-ignore
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const conn = new Connection(process.env.HELIUS_DEVNET_RPC || "https://api.devnet.solana.com", "confirmed");
const coder = new BorshCoder(idl as any);

function deriveChatId(u1: PublicKey, u2: PublicKey): number {
  const sorted = [u1.toBase58(), u2.toBase58()].sort();
  let hash = 0;
  const str = sorted[0] + sorted[1];
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

async function main() {
  const all = await conn.getProgramAccounts(PROGRAM_ID);
  
  const profiles: any[] = [];
  const chats: any[] = [];
  const messages: any[] = [];

  for (const { pubkey, account } of all) {
    try { const d = coder.accounts.decode("Profile", account.data) as any; if (d.owner) profiles.push({ pda: pubkey.toBase58(), ...d }); continue; } catch {}
    try { const d = coder.accounts.decode("Chat", account.data) as any; if (d.user1) chats.push({ pda: pubkey.toBase58(), ...d }); continue; } catch {}
    try { const d = coder.accounts.decode("Message", account.data) as any; if (d.sender) messages.push({ pda: pubkey.toBase58(), ...d }); continue; } catch {}
  }

  console.log("=== PROFILES ===");
  for (const p of profiles) {
    console.log(`  ${p.owner.toBase58()} → @${p.username} "${p.displayName}"`);
  }

  console.log("\n=== CHATS ===");
  for (const c of chats) {
    const u1 = c.user1.toBase58();
    const u2 = c.user2.toBase58();
    const expectedId = deriveChatId(c.user1, c.user2);
    console.log(`  Chat PDA: ${c.pda}`);
    console.log(`    user1: ${u1}`);
    console.log(`    user2: ${u2}`);
    console.log(`    chatId field: ${c.chatId?.toString()}`);
    console.log(`    deriveChatId(u1,u2): ${expectedId}`);
    console.log(`    messageCount: ${c.messageCount?.toString()}`);
  }

  console.log("\n=== MESSAGES ===");
  for (const m of messages) {
    console.log(`  [chatId=${m.chatId?.toString()} idx=${m.messageIndex?.toString()}] sender=${m.sender.toBase58().slice(0,8)}... content=${(m.content || "").slice(0, 50)}`);
  }

  // Now verify deriveChatId symmetry for all profile pairs
  if (profiles.length >= 2) {
    console.log("\n=== DERIVECHATID SYMMETRY TEST ===");
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const a = profiles[i].owner;
        const b = profiles[j].owner;
        const ab = deriveChatId(a, b);
        const ba = deriveChatId(b, a);
        const ok = ab === ba ? "✅" : "❌ MISMATCH";
        console.log(`  ${a.toBase58().slice(0,8)} ↔ ${b.toBase58().slice(0,8)}: ${ab} vs ${ba} ${ok}`);
      }
    }
  }
}
main().catch(console.error);
