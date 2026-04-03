const { Connection, PublicKey } = require('@solana/web3.js');
const crypto = require('crypto');

const c = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const programId = new PublicKey('EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ');

// Profile discriminator: sha256("account:Profile")[0..8]
const PROFILE_DISC = crypto.createHash('sha256').update('account:Profile').digest().slice(0, 8);
console.log('Profile disc:', PROFILE_DISC.toString('hex'));

async function main() {
  // Fetch accounts with Profile discriminator filter
  const bs58 = require('bs58');
  const encode = bs58.default ? bs58.default.encode : bs58.encode;
  const accounts = await c.getProgramAccounts(programId, {
    filters: [{ memcmp: { offset: 0, bytes: encode(PROFILE_DISC) } }],
  });
  
  console.log(`Found ${accounts.length} Profile accounts\n`);
  
  // Try to parse some
  for (const acc of accounts.slice(0, 10)) {
    const data = Buffer.from(acc.account.data);
    // Skip 8 byte discriminator
    // owner: 32 bytes pubkey
    const owner = new PublicKey(data.slice(8, 40));
    // username: borsh string = 4 byte len + string
    const usernameLen = data.readUInt32LE(40);
    const username = data.slice(44, 44 + usernameLen).toString('utf8');
    // display_name follows
    const dnOffset = 44 + usernameLen;
    const dnLen = data.readUInt32LE(dnOffset);
    const displayName = data.slice(dnOffset + 4, dnOffset + 4 + dnLen).toString('utf8');
    
    console.log(`PDA: ${acc.pubkey.toBase58()}`);
    console.log(`  Owner: ${owner.toBase58()}`);
    console.log(`  Username: ${username}`);
    console.log(`  Display: ${displayName}`);
    console.log(`  Lamports: ${acc.account.lamports}`);
    console.log();
  }
}

main().catch(console.error);
