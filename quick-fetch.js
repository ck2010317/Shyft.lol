const { Connection, PublicKey, Keypair } = require("@solana/web3.js");
const { Program, AnchorProvider, Wallet } = require("@coral-xyz/anchor");
const idl = require("./src/lib/idl.json");
const fs = require("fs");

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC = "https://devnet.helius-rpc.com/?api-key=2cf03460-f790-4350-a211-18086a3a3fd2";
const PROFILE_SEED = Buffer.from("profile");

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const kp = Keypair.generate();
  const provider = new AnchorProvider(conn, new Wallet(kp), { commitment: "confirmed" });
  const program = new Program(idl, provider);
  
  const w1 = new PublicKey("Gk5sqqsD3WiFeZYexwWoTeFsBQrWPN9zcUdtCBVbdRmd");
  const [pda1] = PublicKey.findProgramAddressSync([PROFILE_SEED, w1.toBuffer()], PROGRAM_ID);
  
  try {
    const profile = await program.account.profile.fetch(pda1);
    console.log("SUCCESS - Profile data:", JSON.stringify(profile, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));
  } catch (err) {
    console.log("FAILED:", err.message);
  }
}
main();
