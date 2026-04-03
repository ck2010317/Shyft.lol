const { Connection, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const idl = require('./src/lib/idl.json');

const programId = new PublicKey('EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ');
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Create a read-only provider
const provider = new anchor.AnchorProvider(connection, {
  publicKey: PublicKey.default,
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs,
}, { commitment: 'confirmed' });

const program = new anchor.Program(idl, programId, provider);

async function main() {
  console.log('Fetching all profiles...');
  try {
    const profiles = await program.account.profile.all();
    console.log(`Found ${profiles.length} profiles via Anchor`);
    profiles.slice(0, 5).forEach(p => {
      console.log(`  ${p.publicKey.toBase58()}: @${p.account.username} (${p.account.owner.toBase58()})`);
    });
  } catch(e) {
    console.error('Error fetching profiles:', e.message);
  }

  console.log('\nFetching all followAccounts...');
  try {
    const follows = await program.account.followAccount.all();
    console.log(`Found ${follows.length} follows via Anchor`);
  } catch(e) {
    console.error('Error fetching follows:', e.message);
  }

  console.log('\nFetching all posts...');
  try {
    const posts = await program.account.post.all();
    console.log(`Found ${posts.length} posts via Anchor`);
    posts.slice(0, 3).forEach(p => {
      console.log(`  ${p.publicKey.toBase58()}: "${(p.account.content || '').slice(0, 50)}..."`);
    });
  } catch(e) {
    console.error('Error fetching posts:', e.message);
  }
}

main().catch(console.error);
