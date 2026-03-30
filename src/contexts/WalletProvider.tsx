"use client";

import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

const HELIUS_MAINNET = "https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1";

const solanaRpcs = {
  "solana:mainnet": {
    rpc: createSolanaRpc(HELIUS_MAINNET),
    rpcSubscriptions: createSolanaRpcSubscriptions("wss://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1"),
    blockExplorerUrl: "https://explorer.solana.com",
  },
  "solana:devnet": {
    rpc: createSolanaRpc("https://devnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1"),
    rpcSubscriptions: createSolanaRpcSubscriptions("wss://devnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1"),
    blockExplorerUrl: "https://explorer.solana.com/?cluster=devnet",
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
