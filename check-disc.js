const crypto = require('crypto');
const tries = [
  'account:Profile', 'account:UserProfile', 
  'account:profile', 'account:user_profile',
  'account:Post', 'account:Comment', 'account:Chat', 'account:Message',
  'account:Follow', 'account:Reaction', 'account:Community',
  'account:CommunityMember', 'account:PostCounter',
  // Maybe the deploy changed names
  'account:UserProfileV2', 'account:PostV2',
];
tries.forEach(name => {
  const hash = crypto.createHash('sha256').update(name).digest();
  const disc = hash.slice(0,8).toString('hex');
  console.log(disc, '<-', name);
});
console.log('\nLooking for:');
console.log('b865a5bc5f3f7fbc - 41 accs (confirmed profile PDAs)');
console.log('aeb1883c8a5494d1 - 33 accs');
console.log('e78db4626da8afa6 - 3 accs');
console.log('184662bf3a907b9e - 1 acc');
