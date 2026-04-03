const crypto = require('crypto');

// Check what aeb1883c8a5494d1 and e78db4626da8afa6 and 184662bf3a907b9e are
// They might be Follow or other account types from old deploys
const targets = ['aeb1883c8a5494d1', 'e78db4626da8afa6', '184662bf3a907b9e'];

// Try various Anchor account name patterns
const guesses = [
  'FollowAccount', 'Follow', 'Membership', 'CommunityMember',
  'PostCounter', 'UserProfile', 'FriendList', 'FriendRequest', 
  'Friend', 'DelegatedProfile', 'ChatAccount', 'MessageAccount',
  'PostReaction', 'LikeAccount', 'Tip', 'Payment',
  'Token', 'Launch', 'Notification',
];

const found = {};
guesses.forEach(name => {
  const hash = crypto.createHash('sha256').update('account:' + name).digest();
  const disc = hash.slice(0, 8).toString('hex');
  if (targets.includes(disc)) {
    found[disc] = name;
  }
});

console.log('Resolved:');
targets.forEach(t => {
  console.log(`  ${t} -> ${found[t] || 'NOT FOUND'}`);
});
