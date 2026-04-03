"use client";

import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

// RPC key is now hidden behind /api/rpc proxy — no key in the client bundle
const HELIUS_MAINNET = typeof window !== "undefined"
  ? `${window.location.origin}/api/rpc`
  : `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY_PRIVATE || process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

const solanaRpcs = {
  "solana:mainnet": {
    rpc: createSolanaRpc(HELIUS_MAINNET),
    rpcSubscriptions: createSolanaRpcSubscriptions(`wss://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`),
    blockExplorerUrl: "https://explorer.solana.com",
  },
} as const;

export default function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId="cmn36w5d1008c0cjmqphxqth6"
      config={{
        appearance: {
          theme: "light",
          accentColor: "#2563EB",
          logo: "/favicon.svg",
          landingHeader: "Welcome to Shyft",
          loginMessage: "Sign in to Shyft — on-chain social on Solana",
          walletChainType: "solana-only",
          walletList: ["phantom", "solflare", "backpack", "detected_solana_wallets"],
        },
        loginMethods: ["email", "google", "twitter", "github", "wallet"],
        solana: {
          rpcs: solanaRpcs,
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
