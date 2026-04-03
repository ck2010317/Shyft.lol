import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

/**
 * /api/stats — Returns live on-chain stats for the landing page.
 * Counts program accounts by type using discriminator filters.
 * Cached for 60 seconds to avoid hammering RPC.
 */

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const RPC_URL = process.env.HELIUS_MAINNET_RPC || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY_PRIVATE || process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

// Anchor account discriminators as base58 (first 8 bytes of SHA256("account:<Name>"))
const DISCRIMINATORS: Record<string, string> = {
  Profile:  "XqtBdGS7oVD",
  Post:     "2SCFvsZq1W5",
  Follow:   "eJ5PtCerHZU",
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

async function fetchStats(): Promise<Record<string, number>> {
  // Return cache if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.data;
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const stats: Record<string, number> = {};

  // Fetch counts in parallel using getProgramAccounts with dataSlice(0,0) for efficiency
  const entries = Object.entries(DISCRIMINATORS);
  const results = await Promise.allSettled(
    entries.map(([name, disc]) =>
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ memcmp: { offset: 0, bytes: disc } }],
        dataSlice: { offset: 0, length: 0 }, // Don't fetch data, just count
      }).then(accounts => ({ name, count: accounts.length }))
    )
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      stats[result.value.name] = result.value.count;
    } else {
      // On error, use cached value or 0
      const name = entries[results.indexOf(result)][0];
      stats[name] = cache?.data[name] || 0;
    }
  }

  // Also get total transaction count for the program
  try {
    const signatures = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 1000 });
    stats.Transactions = signatures.length;
  } catch {
    stats.Transactions = cache?.data.Transactions || 0;
  }

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
