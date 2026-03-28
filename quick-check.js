const { Connection, PublicKey } = require("@solana/web3.js");
const conn = new Connection("https://devnet.helius-rpc.com/?api-key=2cf03460-f790-4350-a211-18086a3a3fd2", "confirmed");
const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const PROFILE_SEED = Buffer.from("profile");

async function main() {
  const w1 = new PublicKey("Gk5sqqsD3WiFeZYexwWoTeFsBQrWPN9zcUdtCBVbdRmd");
  const [pda1] = PublicKey.findProgramAddressSync([PROFILE_SEED, w1.toBuffer()], PROGRAM_ID);
  const info1 = await conn.getAccountInfo(pda1);
  console.log("Profile PDA:", pda1.toBase58());
  console.log("Exists:", !!info1, info1 ? "size:" + info1.data.length : "");
  
  const accts = await conn.getProgramAccounts(PROGRAM_ID, { dataSlice: { offset: 0, length: 0 }});
  console.log("Total program accounts:", accts.length);
}
main();
