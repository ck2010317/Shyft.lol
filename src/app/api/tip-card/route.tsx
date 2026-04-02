import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get("user") || "someone";
  const amount = searchParams.get("amount") || "0";
  const tips = searchParams.get("tips") || "1";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200",
          height: "630",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0A0A0F",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-100px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "60px 80px",
            flex: 1,
            justifyContent: "center",
          }}
        >
          {/* Top label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#10B981",
                textTransform: "uppercase" as const,
                letterSpacing: "3px",
                display: "flex",
              }}
            >
              TIP EARNINGS
            </div>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10B981",
                display: "flex",
              }}
            />
          </div>

          {/* Username */}
          <div
            style={{
              fontSize: "32px",
              fontWeight: 600,
              color: "#94A3B8",
              marginBottom: "16px",
              display: "flex",
            }}
          >
            @{user}
          </div>

          {/* Big amount */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                fontSize: "120px",
                fontWeight: 800,
                color: "#FFFFFF",
                lineHeight: 1,
                letterSpacing: "-4px",
                display: "flex",
              }}
            >
              +{amount}
            </div>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color: "#10B981",
                display: "flex",
              }}
            >
              SOL
            </div>
          </div>

          {/* Tip count */}
          <div
            style={{
              fontSize: "22px",
              color: "#475569",
              display: "flex",
            }}
          >
            from {tips} {Number(tips) === 1 ? "tip" : "tips"}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 80px",
            borderTop: "1px solid rgba(148,163,184,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#FFFFFF",
                display: "flex",
              }}
            >
              SHYFT
            </div>
            <div
              style={{
                fontSize: "16px",
                color: "#475569",
                display: "flex",
              }}
            >
              shyft.lol
            </div>
          </div>
          <div
            style={{
              fontSize: "14px",
              color: "#334155",
              display: "flex",
            }}
          >
            On-Chain Social on Solana
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
