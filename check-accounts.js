const { Connection, PublicKey } = require('@solana/web3.js');
const crypto = require('crypto');

const c = new Connection('https://api.mainnet-beta.solana.com');
const programId = new PublicKey('EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ');

// Compute discriminators
const names = ['UserProfile','Post','Comment','Chat','Message','Follow','Community','CommunityMember','Reaction','PostCounter'];
const discMap = {};
names.forEach(name => {
  const hash = crypto.createHash('sha256').update('account:' + name).digest();
  const disc = hash.slice(0,8).toString('hex');
  discMap[disc] = name;
});

console.log('Known discriminators:');
Object.entries(discMap).forEach(([d, n]) => console.log(`  ${n}: ${d}`));
console.log();

c.getProgramAccounts(programId, { dataSlice: { offset: 0, length: 8 } }).then(accs => {
  const counts = {};
  accs.forEach(a => {
    const disc = Buffer.from(a.account.data).toString('hex');
    const name = discMap[disc] || 'UNKNOWN(' + disc + ')';
    counts[name] = (counts[name] || 0) + 1;
  });
  
  console.log('Account breakdown (298 total):');
  Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });
  
  // Check what's missing
  console.log('\nMissing types:');
  names.forEach(name => {
    if (!counts[name]) console.log(`  ${name}: 0 accounts!`);
  });
}).catch(e => console.error(e));
