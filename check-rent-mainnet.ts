import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROGRAM_ID = new PublicKey('EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ');
const RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

async function main() {
  const connection = new Connection(RPC, 'confirmed');
  console.log('Fetching all program accounts on mainnet...\n');

  const fullAccounts = await connection.getProgramAccounts(PROGRAM_ID);

  const sizeToType: Record<number, string> = {
    315: 'Profile',
    269: 'Post',
    192: 'Comment',
    73: 'Reaction',
    72: 'Follow',
    429: 'Profile (old)',
    853: 'Profile (old lg)',
    577: 'Post (old)',
    232: 'Comment (old)',
    81: 'Reaction (old)',
    80: 'Follow (old)',
    96: 'Chat',
    589: 'Message',
  };

  const categories: Record<string, { count: number; totalRent: number; size: number }> = {};
  let totalRent = 0;
  let totalAccounts = 0;

  for (const acct of fullAccounts) {
    const size = acct.account.data.length;
    const rent = acct.account.lamports;
    const type = sizeToType[size] || `Unknown (${size}b)`;
    if (!categories[type]) categories[type] = { count: 0, totalRent: 0, size };
    categories[type].count++;
    categories[type].totalRent += rent;
    totalRent += rent;
    totalAccounts++;
  }

  const sorted = Object.entries(categories).sort((a, b) => b[1].totalRent - a[1].totalRent);

  console.log('Type                       Count    Rent (SOL)       Size');
  console.log('─'.repeat(60));
  for (const [type, data] of sorted) {
    const sol = (data.totalRent / LAMPORTS_PER_SOL).toFixed(6);
    console.log(
      type.padEnd(27) +
        String(data.count).padStart(5) +
        '    ' +
        sol.padStart(12) +
        ' SOL    ' +
        data.size +
        'b'
    );
  }
  console.log('─'.repeat(60));
  console.log(
    'TOTAL'.padEnd(27) +
      String(totalAccounts).padStart(5) +
      '    ' +
      (totalRent / LAMPORTS_PER_SOL).toFixed(6).padStart(12) +
      ' SOL'
  );
  console.log(
    '\n💵 At $150/SOL: $' + ((totalRent / LAMPORTS_PER_SOL) * 150).toFixed(2)
  );
  console.log('   All rent is refundable if accounts are closed.');
}

main().catch(console.error);
