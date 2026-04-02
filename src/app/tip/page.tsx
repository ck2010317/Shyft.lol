import { Metadata } from "next";

interface Props {
  searchParams: Promise<{ amount?: string; tips?: string; user?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const user = params.user || "someone";
  const amount = params.amount || "0";
  const tips = params.tips || "1";

  const ogImageUrl = `https://www.shyft.lol/api/tip-card?user=${encodeURIComponent(user)}&amount=${amount}&tips=${tips}`;
  const title = `💸 @${user} earned ${amount} SOL in tips on Shyft`;
  const description = `${amount} SOL from ${tips} ${Number(tips) === 1 ? "tip" : "tips"} on a single post. Get tipped for your posts on Shyft — the on-chain social platform on Solana.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      type: "website",
      siteName: "Shyft",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function TipPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = params.user || "someone";
  const amount = params.amount || "0";

  // Render a real page so X/Twitter bot can scrape meta tags
  // Client-side redirect happens after 2 seconds
  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content="2;url=https://www.shyft.lol" />
      </head>
      <body style={{ margin: 0, backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: "48px", margin: "0 0 16px" }}>💸</p>
          <h1 style={{ fontSize: "24px", color: "#0F172A", margin: "0 0 8px" }}>@{user} earned {amount} SOL in tips</h1>
          <p style={{ fontSize: "16px", color: "#64748B", margin: "0 0 24px" }}>on Shyft — On-Chain Social on Solana</p>
          <a href="https://www.shyft.lol" style={{ color: "#2563EB", fontSize: "14px" }}>Go to Shyft →</a>
        </div>
      </body>
    </html>
  );
}
