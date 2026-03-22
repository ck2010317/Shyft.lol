import { NextRequest, NextResponse } from "next/server";

const MAGICBLOCK_API_URL = "https://api.docs.magicblock.app";

export async function POST(req: NextRequest) {
  const { endpoint, body } = await req.json();

  const allowedEndpoints = [
    "/private/tx/deposit",
    "/private/tx/transfer-amount",
    "/private/tx/prepare-withdrawal",
    "/private/tx/withdraw",
    "/config",
  ];

  if (!allowedEndpoints.includes(endpoint)) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  try {
    const response = await fetch(`${MAGICBLOCK_API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to reach MagicBlock API" },
      { status: 502 }
    );
  }
}

export async function GET() {
  try {
    const response = await fetch(`${MAGICBLOCK_API_URL}/config`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to reach MagicBlock API" },
      { status: 502 }
    );
  }
}
