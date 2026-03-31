/**
 * E2E Chat Test: 3 users, 2 chats, full key exchange + encrypted messages
 * 
 * Scenario:
 *   - Alice creates Chat1 with Bob (publishes her PUBKEY)
 *   - Bob joins Chat1 (publishes his PUBKEY), then sends encrypted msg to Alice
 *   - Alice reads Chat1 and decrypts Bob's message
 *   - Alice creates Chat2 with Charlie (publishes her PUBKEY)  
 *   - Charlie joins Chat2 (publishes his PUBKEY), then sends encrypted msg to Alice
 *   - Alice reads Chat2 and decrypts Charlie's message
 * 
 * All transactions treasury-sponsored (payer = treasury)
 */
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction,
} from "@solana/web3.js";
import { Program, AnchorProvider, Idl, BN, BorshCoder, Wallet } from "@coral-xyz/anchor";
import nacl from "tweetnacl";
// @ts-ignore
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import idlJson from "./src/lib/idl.json";

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC = process.env.HELIUS_DEVNET_RPC || "https://api.devnet.solana.com";
const CHAT_SEED = Buffer.from("chat");
const MESSAGE_SEED = Buffer.from("message");

function toLEBytes(num: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigUint64(0, BigInt(num), true);
  return new Uint8Array(buffer);
}

function getChatPda(chatId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CHAT_SEED, toLEBytes(chatId)], PROGRAM_ID);
}

function getMessagePda(chatId: number, msgIdx: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([MESSAGE_SEED, toLEBytes(chatId), toLEBytes(msgIdx)], PROGRAM_ID);
}

function deriveChatId(u1: PublicKey, u2: PublicKey): number {
  const sorted = [u1.toBase58(), u2.toBase58()].sort();
  let hash = 0;
  const str = sorted[0] + sorted[1];
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function toBase64(b: Uint8Array): string { return Buffer.from(b).toString("base64"); }
function fromBase64(s: string): Uint8Array { return new Uint8Array(Buffer.from(s, "base64")); }

function formatPubkey(pk: Uint8Array): string { return `PUBKEY:${toBase64(pk)}`; }
function parsePubkey(c: string): Uint8Array | null {
  if (!c.startsWith("PUBKEY:")) return null;
  try { return fromBase64(c.slice(7)); } catch { return null; }
}
function encryptMsg(plain: string, mySecret: Uint8Array, theirPublic: Uint8Array): string {
  const msg = new TextEncoder().encode(plain);
  const nonce = nacl.randomBytes(24);
  const enc = nacl.box(msg, nonce, theirPublic, mySecret);
  if (!enc) throw new Error("encrypt failed");
  return `ENC:${toBase64(nonce)}:${toBase64(enc)}`;
}
function decryptMsg(content: string, senderPublic: Uint8Array, mySecret: Uint8Array): string | null {
  if (!content.startsWith("ENC:")) return null;
  const parts = content.split(":");
  if (parts.length !== 3) return null;
  try {
    const dec = nacl.box.open(fromBase64(parts[2]), fromBase64(parts[1]), senderPublic, mySecret);
    return dec ? new TextDecoder().decode(dec) : null;
  } catch { return null; }
}

async function sendIx(conn: Connection, ix: TransactionInstruction, signers: Keypair[]): Promise<string> {
  const tx = new Transaction().add(ix);
  tx.feePayer = signers[0].publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const sig = await conn.sendTransaction(tx, signers, { skipPreflight: false });
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}

async function createChat(program: Program, conn: Connection, treasury: Keypair, user: Keypair, user2: PublicKey, chatId: number) {
  const [chatPda] = getChatPda(chatId);
  const ix = await program.methods.createChat(new BN(chatId))
    .accounts({ chat: chatPda, user1: user.publicKey, user2, payer: treasury.publicKey, systemProgram: SystemProgram.programId })
    .instruction();
  return sendIx(conn, ix, [treasury, user]);
}

async function sendMsg(program: Program, conn: Connection, treasury: Keypair, sender: Keypair, chatId: number, idx: number, content: string) {
  const [msgPda] = getMessagePda(chatId, idx);
  const [chatPda] = getChatPda(chatId);
  const ix = await program.methods.sendMessage(new BN(chatId), new BN(idx), content, false, new BN(0))
    .accounts({ message: msgPda, chat: chatPda, sender: sender.publicKey, payer: treasury.publicKey, systemProgram: SystemProgram.programId })
    .instruction();
  return sendIx(conn, ix, [treasury, sender]);
}

async function readMsgs(conn: Connection, chatId: number) {
  const coder = new BorshCoder(idlJson as any);
  const msgs: { idx: number; sender: string; content: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const [pda] = getMessagePda(chatId, i);
    const acc = await conn.getAccountInfo(pda, "confirmed");
    if (!acc) continue;
    const d = coder.accounts.decode("Message", acc.data) as any;
    msgs.push({ idx: i, sender: d.sender.toBase58(), content: d.content });
  }
  return msgs;
}

function findPeerKey(msgs: { sender: string; content: string }[], myAddr: string): Uint8Array | null {
  for (const m of msgs) {
    if (m.sender !== myAddr && m.content.startsWith("PUBKEY:")) {
      return parsePubkey(m.content);
    }
  }
  return null;
}

// ===== MAIN =====
async function main() {
  const conn = new Connection(RPC, "confirmed");
  const treasury = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.TREASURY_PRIVATE_KEY!)));

  const alice = Keypair.generate();
  const bob = Keypair.generate();
  const charlie = Keypair.generate();

  const aliceKeys = nacl.box.keyPair();
  const bobKeys = nacl.box.keyPair();
  const charlieKeys = nacl.box.keyPair();

  const wallet = new Wallet(treasury);
  const provider = new AnchorProvider(conn, wallet, { commitment: "confirmed" });
  const program = new Program(idlJson as Idl, provider);

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   E2E Chat Test: 3 Users, 2 Chats, Treasury     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`Treasury: ${treasury.publicKey.toBase58().slice(0,12)}...  Balance: ${(await conn.getBalance(treasury.publicKey)) / 1e9} SOL`);
  console.log(`Alice:    ${alice.publicKey.toBase58().slice(0,12)}...`);
  console.log(`Bob:      ${bob.publicKey.toBase58().slice(0,12)}...`);
  console.log(`Charlie:  ${charlie.publicKey.toBase58().slice(0,12)}...`);

  let passed = 0;
  let failed = 0;

  function check(label: string, ok: boolean) {
    if (ok) { passed++; console.log(`  ✅ ${label}`); }
    else { failed++; console.log(`  ❌ ${label}`); }
  }

  // ===================== CHAT 1: Alice <-> Bob =====================
  const c1 = deriveChatId(alice.publicKey, bob.publicKey);
  console.log(`\n━━━ Chat 1: Alice ↔ Bob (id=${c1}) ━━━\n`);

  // Alice creates chat + publishes PUBKEY at msg[0]
  console.log("  [Alice] Creating chat...");
  await createChat(program, conn, treasury, alice, bob.publicKey, c1);
  console.log("  [Alice] Publishing PUBKEY at msg[0]...");
  await sendMsg(program, conn, treasury, alice, c1, 0, formatPubkey(aliceKeys.publicKey));
  console.log("  [Alice] Sending plaintext at msg[1]...");
  await sendMsg(program, conn, treasury, alice, c1, 1, "PLAIN:Hey Bob!");

  // Bob joins: publishes PUBKEY at msg[2], then sends encrypted at msg[3]
  console.log("  [Bob]   Publishing PUBKEY at msg[2]...");
  await sendMsg(program, conn, treasury, bob, c1, 2, formatPubkey(bobKeys.publicKey));
  console.log("  [Bob]   Sending encrypted msg at msg[3]...");
  await sendMsg(program, conn, treasury, bob, c1, 3, encryptMsg("Hello Alice, E2E works!", bobKeys.secretKey, aliceKeys.publicKey));

  // Verify
  const c1Msgs = await readMsgs(conn, c1);
  check("Chat 1 has 4 messages", c1Msgs.length === 4);
  check("msg[0] is Alice's PUBKEY", c1Msgs[0]?.content.startsWith("PUBKEY:") && c1Msgs[0]?.sender === alice.publicKey.toBase58());
  check("msg[2] is Bob's PUBKEY", c1Msgs[2]?.content.startsWith("PUBKEY:") && c1Msgs[2]?.sender === bob.publicKey.toBase58());

  const bobPeer = findPeerKey(c1Msgs, bob.publicKey.toBase58());
  check("Bob finds Alice's peer key", bobPeer !== null);

  const alicePeer1 = findPeerKey(c1Msgs, alice.publicKey.toBase58());
  check("Alice finds Bob's peer key", alicePeer1 !== null);

  const dec1 = c1Msgs[3] ? decryptMsg(c1Msgs[3].content, bobKeys.publicKey, aliceKeys.secretKey) : null;
  check(`Alice decrypts Bob's msg: "${dec1}"`, dec1 === "Hello Alice, E2E works!");

  // ===================== CHAT 2: Alice <-> Charlie =====================
  const c2 = deriveChatId(alice.publicKey, charlie.publicKey);
  console.log(`\n━━━ Chat 2: Alice ↔ Charlie (id=${c2}) ━━━\n`);

  // Alice creates 2nd chat + publishes PUBKEY
  console.log("  [Alice]   Creating chat...");
  await createChat(program, conn, treasury, alice, charlie.publicKey, c2);
  console.log("  [Alice]   Publishing PUBKEY at msg[0]...");
  await sendMsg(program, conn, treasury, alice, c2, 0, formatPubkey(aliceKeys.publicKey));
  console.log("  [Alice]   Sending plaintext at msg[1]...");
  await sendMsg(program, conn, treasury, alice, c2, 1, "PLAIN:Hey Charlie!");

  // Charlie joins: publishes PUBKEY at msg[2], sends encrypted at msg[3]
  console.log("  [Charlie] Publishing PUBKEY at msg[2]...");
  await sendMsg(program, conn, treasury, charlie, c2, 2, formatPubkey(charlieKeys.publicKey));
  console.log("  [Charlie] Sending encrypted msg at msg[3]...");
  await sendMsg(program, conn, treasury, charlie, c2, 3, encryptMsg("Yo Alice, second chat works!", charlieKeys.secretKey, aliceKeys.publicKey));

  // Verify
  const c2Msgs = await readMsgs(conn, c2);
  check("Chat 2 has 4 messages", c2Msgs.length === 4);
  check("msg[0] is Alice's PUBKEY", c2Msgs[0]?.content.startsWith("PUBKEY:") && c2Msgs[0]?.sender === alice.publicKey.toBase58());
  check("msg[2] is Charlie's PUBKEY", c2Msgs[2]?.content.startsWith("PUBKEY:") && c2Msgs[2]?.sender === charlie.publicKey.toBase58());

  const charliePeer = findPeerKey(c2Msgs, charlie.publicKey.toBase58());
  check("Charlie finds Alice's peer key", charliePeer !== null);

  const alicePeer2 = findPeerKey(c2Msgs, alice.publicKey.toBase58());
  check("Alice finds Charlie's peer key", alicePeer2 !== null);

  const dec2 = c2Msgs[3] ? decryptMsg(c2Msgs[3].content, charlieKeys.publicKey, aliceKeys.secretKey) : null;
  check(`Alice decrypts Charlie's msg: "${dec2}"`, dec2 === "Yo Alice, second chat works!");

  // ===================== CROSS-CHAT ISOLATION =====================
  console.log(`\n━━━ Cross-Chat Isolation ━━━\n`);
  const wrongDec = c2Msgs[3] ? decryptMsg(c2Msgs[3].content, bobKeys.publicKey, aliceKeys.secretKey) : "skip";
  check("Can't decrypt Chat2 msg with Bob's key (isolation)", wrongDec === null);

  const wrongDec2 = c1Msgs[3] ? decryptMsg(c1Msgs[3].content, charlieKeys.publicKey, aliceKeys.secretKey) : "skip";
  check("Can't decrypt Chat1 msg with Charlie's key (isolation)", wrongDec2 === null);

  // ===================== CLEANUP =====================
  console.log("\n━━━ Cleanup ━━━\n");
  const { sha256 } = await import("@noble/hashes/sha256");
  const disc = sha256(new TextEncoder().encode("global:admin_force_close")).slice(0, 8);

  const allPdas = [
    getChatPda(c1)[0], getChatPda(c2)[0],
    ...Array.from({ length: 4 }, (_, i) => getMessagePda(c1, i)[0]),
    ...Array.from({ length: 4 }, (_, i) => getMessagePda(c2, i)[0]),
  ];

  const cleanTx = new Transaction();
  for (const p of allPdas) {
    cleanTx.add(new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [{ pubkey: p, isSigner: false, isWritable: true }, { pubkey: treasury.publicKey, isSigner: true, isWritable: true }],
      data: Buffer.from(disc),
    }));
  }
  try {
    const sig = await conn.sendTransaction(cleanTx, [treasury]);
    await conn.confirmTransaction(sig, "confirmed");
    console.log("  ✅ All test accounts cleaned up");
  } catch { console.log("  ⚠️  Cleanup partial (some accounts may not exist)"); }

  // ===================== RESULTS =====================
  console.log("\n╔══════════════════════════════════════════════════╗");
  if (failed === 0) {
    console.log(`║   ALL ${passed} TESTS PASSED ✅                        ║`);
  } else {
    console.log(`║   ${passed} PASSED, ${failed} FAILED ❌                       ║`);
  }
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error("\n❌ TEST CRASHED:", err); process.exit(1); });
