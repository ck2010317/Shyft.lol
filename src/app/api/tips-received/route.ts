import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY_PRIVATE;

/**
 * GET /api/tips-received?wallet=<address>
 * 
 * Queries Helius enhanced transaction history for all incoming native SOL
 * transfers to the given wallet. Returns total SOL received + transfer count.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 });
  }

  try {
    let totalLamports = 0;
    let tipCount = 0;
    let before: string | undefined;
    let pages = 0;
    const MAX_PAGES = 10; // safety limit — 1000 txs max

    // Paginate through transaction history
    while (pages < MAX_PAGES) {
      const reqUrl: string = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=100&type=TRANSFER${before ? `&before=${before}` : ""}`;

      const res: Response = await fetch(reqUrl, {
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) break;
      const txs: any[] = await res.json();
      if (!Array.isArray(txs) || txs.length === 0) break;

      for (const tx of txs) {
        // Look at nativeTransfers for SOL going TO this wallet
        const nativeTransfers: any[] = tx.nativeTransfers || [];
        for (const nt of nativeTransfers) {
          if (
            nt.toUserAccount === wallet &&
            nt.fromUserAccount !== wallet &&
            nt.amount > 0
          ) {
            totalLamports += nt.amount;
            tipCount++;
          }
        }
      }

      // Set pagination cursor
      before = txs[txs.length - 1]?.signature;
      if (txs.length < 100) break; // last page
      pages++;
    }

    const totalSol = totalLamports / 1e9;

    return NextResponse.json({
      wallet,
      totalSol: Math.round(totalSol * 1000) / 1000, // 3 decimal places
      tipCount,
    });
  } catch (err: any) {
    console.error("tips-received error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch" }, { status: 500 });
  }
}
