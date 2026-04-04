import { NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  type ConfirmedSignatureInfo,
} from "@solana/web3.js";

/**
 * /api/stats — Returns live on-chain stats for the landing page.
 * - Account counts: getProgramAccounts with discriminator filters
 * - Transaction count: paginated getSignaturesForAddress (all-time total)
 * Cached for 60 seconds to avoid hammering RPC.
 */

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY_PRIVATE}`;

// Anchor account discriminators as base58 (first 8 bytes of SHA256("account:<Name>"))
const DISCRIMINATORS: Record<string, string> = {
  Profile:  "XqtBdGS7oVD",
  Post:     "2SCFvsZq1W5",
  Follow:   "WDkFKLBZQjJ",   // account:FollowAccount
  Reaction: "eqoxdQG2hzA",
  Comment:  "SBKTEqMLuVa",
  Chat:     "VSNktsnZqf6",
  Message:  "KVs5m1Nqcgc",
};

interface StatsCache {
  data: Record<string, number>;
  fetchedAt: number;
}

let cache: StatsCache | null = null;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Paginate through ALL transaction signatures for the program.
 * getSignaturesForAddress returns max 1000 per call, so we loop
 * using `before` cursor until we've fetched them all.
 */
async function getTotalTransactions(connection: Connection): Promise<number> {
  let total = 0;
  let before: string | undefined = undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const opts: { limit: number; before?: string } = { limit: 1000 };
    if (before) opts.before = before;

    const sigs: ConfirmedSignatureInfo[] =
      await connection.getSignaturesForAddress(PROGRAM_ID, opts);

    total += sigs.length;

    if (sigs.length < 1000) break;
    before = sigs[sigs.length - 1].signature;
  }

  return total;
}

async function fetchStats(): Promise<Record<string, number>> {
  // Return cache if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.data;
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const stats: Record<string, number> = {};

  const entries = Object.entries(DISCRIMINATORS);

  const [accountResults, txCount] = await Promise.all([
    // 1) Account counts by type
    Promise.allSettled(
      entries.map(([name, disc]) =>
        connection.getProgramAccounts(PROGRAM_ID, {
          filters: [{ memcmp: { offset: 0, bytes: disc } }],
          dataSlice: { offset: 0, length: 0 },
        }).then(accounts => ({ name, count: accounts.length }))
      )
    ),
    // 2) Total transaction count (paginated, all-time)
    getTotalTransactions(connection).catch((err) => {
      console.error("Failed to fetch tx count:", err?.message || err);
      return cache?.data.Transactions || 0;
    }),
  ]);

  for (const result of accountResults) {
    if (result.status === "fulfilled") {
      stats[result.value.name] = result.value.count;
    } else {
      const name = entries[accountResults.indexOf(result)][0];
      console.error(`Stats fetch failed for ${name}:`, result.reason?.message || result.reason);
      stats[name] = cache?.data[name] || 0;
    }
  }

  stats.Transactions = txCount;

  cache = { data: stats, fetchedAt: Date.now() };
  return stats;
}

export async function GET() {
  try {
    const stats = await fetchStats();

    return NextResponse.json({
      profiles: stats.Profile || 0,
      posts: stats.Post || 0,
      follows: stats.Follow || 0,
      reactions: stats.Reaction || 0,
      comments: stats.Comment || 0,
      chats: stats.Chat || 0,
      messages: stats.Message || 0,
      transactions: stats.Transactions || 0,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err: any) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
