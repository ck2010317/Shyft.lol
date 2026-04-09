import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username") || "anonymous";
  const content = searchParams.get("content") || "A post on Shyft";
  const likes = searchParams.get("likes") || "0";
  const comments = searchParams.get("comments") || "0";
  const avatar = searchParams.get("avatar");

  // Truncate content for display
  const displayContent = content.length > 180 ? content.slice(0, 180) + "…" : content;

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
        {/* Background glows */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)",
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
            background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
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
            justifyContent: "space-between",
          }}
        >
          {/* Header: Avatar + Username */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            {/* Avatar circle */}
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "#1E293B",
                border: "3px solid #2563EB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  width={64}
                  height={64}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "#2563EB",
                    display: "flex",
                  }}
                >
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  display: "flex",
                }}
              >
                @{username}
              </div>
              <div
                style={{
                  fontSize: "16px",
                  color: "#64748B",
                  display: "flex",
                }}
              >
                on Shyft — On-Chain Social
              </div>
            </div>
          </div>

          {/* Post content */}
          <div
            style={{
              fontSize: "36px",
              fontWeight: 500,
              color: "#E2E8F0",
              lineHeight: 1.4,
              maxHeight: "260px",
              overflow: "hidden",
              display: "flex",
            }}
          >
            {displayContent}
          </div>

          {/* Footer: stats + branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: "32px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ fontSize: "22px", display: "flex" }}>❤️</div>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "#94A3B8", display: "flex" }}>
                  {likes}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ fontSize: "22px", display: "flex" }}>💬</div>
                <div style={{ fontSize: "22px", fontWeight: 600, color: "#94A3B8", display: "flex" }}>
                  {comments}
                </div>
              </div>
            </div>

            {/* Brand */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: "#2563EB",
                  letterSpacing: "-0.5px",
                  display: "flex",
                }}
              >
                SHYFT
              </div>
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#475569",
                  display: "flex",
                }}
              />
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#475569",
                  display: "flex",
                }}
              >
                Powered by Solana
              </div>
            </div>
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
