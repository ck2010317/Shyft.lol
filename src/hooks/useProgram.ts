"use client";

import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@/hooks/usePrivyWallet";
import { AnchorProvider } from "@coral-xyz/anchor";
import { ShyftClient } from "@/lib/program";

export function useProgram(): ShyftClient | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const client = useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new ShyftClient(provider);
  }, [connection, wallet]);

  return client;
}
