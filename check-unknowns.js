const { Connection, PublicKey } = require('@solana/web3.js');
const crypto = require('crypto');

const c = new Connection('https://api.mainnet-beta.solana.com');
const programId = new PublicKey('EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ');

// Check accounts with unknown discriminators
const knownDiscs = new Set([
  '202577cdb3b40dc2', // UserProfile
  '08935abab938c096', // Post
  '968760f437c73241', // Comment
  'aa044780b967fab1', // Chat
  '6e97176ec6067db5', // Message
  'def7fd3c4604a433', // Follow
  'c049d39eb2511370', // Community
  '03639bda7499e0ac', // CommunityMember
  'e23d64bfdfdd8e8b', // Reaction
  'd5bbe80685b5663f', // PostCounter
]);

// Get all accounts with full data (first 200 bytes)
c.getProgramAccounts(programId, { dataSlice: { offset: 0, length: 200 } }).then(accs => {
  const unknowns = accs.filter(a => {
    const disc = Buffer.from(a.account.data.slice(0, 8)).toString('hex');
    return !knownDiscs.has(disc);
  });
  
  console.log(`Found ${unknowns.length} accounts with unknown discriminators\n`);
  
  // Group by disc
  const groups = {};
  unknowns.forEach(a => {
    const disc = Buffer.from(a.account.data.slice(0, 8)).toString('hex');
    if (!groups[disc]) groups[disc] = [];
    groups[disc].push(a);
  });
  
  Object.entries(groups).forEach(([disc, accounts]) => {
    console.log(`\nDiscriminator: ${disc} (${accounts.length} accounts)`);
    // Show first account's data
    const first = accounts[0];
    console.log(`  First: ${first.pubkey.toBase58()}`);
    console.log(`  Lamports: ${first.account.lamports}`);
    console.log(`  Data (hex, first 100 bytes): ${Buffer.from(first.account.data.slice(0, 100)).toString('hex')}`);
    
    // Try to read it as a profile PDA
    // Profile seeds: [PROFILE_SEED, owner.as_ref()]
    // After disc (8 bytes), first field is owner (32 bytes Pubkey)
    const possibleOwner = new PublicKey(Buffer.from(first.account.data.slice(8, 40)));
    console.log(`  Possible owner field: ${possibleOwner.toBase58()}`);
    
    // Check if the PDA matches profile seeds
    const PROFILE_SEED = Buffer.from('profile');
    try {
      const [expectedPda] = PublicKey.findProgramAddressSync(
        [PROFILE_SEED, possibleOwner.toBuffer()],
        programId
      );
      console.log(`  Expected profile PDA for this owner: ${expectedPda.toBase58()}`);
      console.log(`  Actual account key: ${first.pubkey.toBase58()}`);
      console.log(`  IS PROFILE PDA: ${expectedPda.equals(first.pubkey)}`);
    } catch(e) {
      console.log(`  PDA check failed: ${e.message}`);
    }
  });
}).catch(e => console.error(e));
