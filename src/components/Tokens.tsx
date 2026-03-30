"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Coins,
  Rocket,
  TrendingUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Crown,
  DollarSign,
  Users,
  BarChart3,
  Wallet,
  ChevronRight,
  Star,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useWallet } from "@/hooks/usePrivyWallet";
import { toast } from "@/components/Toast";
import TokenLaunch from "@/components/TokenLaunch";
import TokenTrade from "@/components/TokenTrade";
import { formatSOL, BAGS_REF_CODE } from "@/lib/bags";

interface TokenItem {
  name: string;
  symbol: string;
  description: string;
  image: string;
  tokenMint: string;
  status: string;
  twitter?: string;
  website?: string;
}

interface ClaimablePosition {
  baseMint: string;
  totalClaimableLamportsUserShare?: string;
  virtualPoolClaimableAmount?: string;
  dammPoolClaimableAmount?: string;
}

export default function Tokens() {
  const { publicKey } = useWallet();
  const { isConnected } = useAppStore();
  const [tab, setTab] = useState<"discover" | "my-tokens" | "earnings">("discover");
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [claimable, setClaimable] = useState<ClaimablePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFees, setLoadingFees] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenItem | null>(null);

  // Fetch token feed
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bags?action=feed");
      const data = await res.json();
      if (data.success && Array.isArray(data.response)) {
        setTokens(data.response);
      }
    } catch (err) {
      console.error("Failed to fetch token feed:", err);
    }
    setLoading(false);
  }, []);

  // Fetch claimable fees
  const fetchClaimable = useCallback(async () => {
    if (!publicKey) return;
    setLoadingFees(true);
    try {
      const res = await fetch(`/api/bags?action=fees&wallet=${publicKey.toBase58()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.response)) {
        setClaimable(data.response);
      }
    } catch (err) {
      console.error("Failed to fetch claimable:", err);
    }
    setLoadingFees(false);
  }, [publicKey]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  useEffect(() => {
    if (tab === "earnings" && publicKey) {
      fetchClaimable();
    }
  }, [tab, publicKey, fetchClaimable]);

  const totalClaimableSOL = claimable.reduce((sum, p) => {
    const amount = Number(p.totalClaimableLamportsUserShare || p.virtualPoolClaimableAmount || 0)
      + Number(p.dammPoolClaimableAmount || 0);
    return sum + amount;
  }, 0);

  const handleClaim = async (tokenMint: string) => {
    if (!publicKey) return;
    try {
      toast("info", "Creating claim transaction...");
      const res = await fetch("/api/bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          walletAddress: publicKey.toBase58(),
          tokenMint,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast("success", "Fees claimed! Check your wallet.");
      fetchClaimable();
    } catch (err: any) {
      toast("error", err.message || "Failed to claim fees");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Creator Tokens</h1>
            <p className="text-xs text-gray-500">Launch, trade & earn — powered by Bags.fm</p>
          </div>
        </div>
        <button
          onClick={() => setShowLaunchModal(true)}
          className="flex items-center gap-1.5 py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium text-sm hover:from-purple-700 hover:to-pink-700 transition"
        >
          <Rocket className="w-4 h-4" />
          Launch Token
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
        {[
          { id: "discover", label: "Discover", icon: TrendingUp },
          { id: "my-tokens", label: "My Tokens", icon: Wallet },
          { id: "earnings", label: "Earnings", icon: DollarSign },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition ${
              tab === id
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Discover Tab */}
      {tab === "discover" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trending Tokens</h2>
            <button
              onClick={fetchTokens}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12">
              <Coins className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No tokens found</p>
              <p className="text-xs text-gray-400 mt-1">Be the first to launch a creator token!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tokens.slice(0, 20).map((token, i) => (
                <button
                  key={token.tokenMint}
                  onClick={() => setSelectedToken(token)}
                  className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition text-left"
                >
                  <span className="text-xs font-medium text-gray-400 w-5">{i + 1}</span>
                  {token.image ? (
                    <img src={token.image} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{token.symbol?.[0] || "?"}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{token.name}</span>
                      <span className="text-xs text-gray-400">${token.symbol}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{token.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      token.status === "MIGRATED"
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : token.status === "PRE_GRAD"
                        ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}>
                      {token.status === "MIGRATED" ? "Live" : token.status === "PRE_GRAD" ? "Pre-Grad" : token.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Tokens Tab */}
      {tab === "my-tokens" && (
        <div>
          {!isConnected ? (
            <div className="text-center py-12">
              <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Connect your wallet to see your tokens</p>
            </div>
          ) : (
            <div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Launch Your Token</span>
                </div>
                <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mb-3">
                  Create your own token and earn fees every time someone trades it. Your supporters can buy in and trade with each other.
                </p>
                <button
                  onClick={() => setShowLaunchModal(true)}
                  className="flex items-center gap-1.5 py-2 px-4 bg-purple-600 text-white rounded-lg font-medium text-xs hover:bg-purple-700 transition"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  Launch Token
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center py-4">
                Tokens you&apos;ve created or hold will appear here.
                <br />
                <a
                  href={`https://bags.fm/?ref=${BAGS_REF_CODE}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline"
                >
                  Browse all tokens on Bags.fm →
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Earnings Tab */}
      {tab === "earnings" && (
        <div>
          {!isConnected ? (
            <div className="text-center py-12">
              <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Connect your wallet to see earnings</p>
            </div>
          ) : (
            <div>
              {/* Earnings Summary */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400 mb-0.5">Total Claimable</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {formatSOL(totalClaimableSOL)} SOL
                    </p>
                  </div>
                  <button
                    onClick={fetchClaimable}
                    className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition"
                  >
                    <RefreshCw className={`w-4 h-4 text-green-500 ${loadingFees ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Claimable Positions */}
              {loadingFees ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                </div>
              ) : claimable.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No claimable fees yet</p>
                  <p className="text-xs text-gray-400 mt-1">Launch a token and get trading volume to earn fees</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {claimable.map((position) => {
                    const claimableAmount = Number(
                      position.totalClaimableLamportsUserShare ||
                      position.virtualPoolClaimableAmount ||
                      0
                    ) + Number(position.dammPoolClaimableAmount || 0);

                    return (
                      <div
                        key={position.baseMint}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
                      >
                        <div>
                          <p className="text-xs font-mono text-gray-600 dark:text-gray-400">
                            {position.baseMint.slice(0, 8)}...{position.baseMint.slice(-8)}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {formatSOL(claimableAmount)} SOL
                          </p>
                        </div>
                        <button
                          onClick={() => handleClaim(position.baseMint)}
                          disabled={claimableAmount <= 0}
                          className="py-1.5 px-3 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Claim
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Token Detail / Trade Modal */}
      {selectedToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            {/* Token Header */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {selectedToken.image ? (
                  <img src={selectedToken.image} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{selectedToken.symbol?.[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedToken.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">${selectedToken.symbol}</span>
                    <a
                      href={`https://bags.fm/${selectedToken.tokenMint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-500 hover:underline flex items-center gap-0.5"
                    >
                      Bags <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedToken(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  ✕
                </button>
              </div>
              {selectedToken.description && (
                <p className="text-xs text-gray-500 mt-2">{selectedToken.description}</p>
              )}
            </div>

            {/* Trade Widget */}
            <div className="p-4">
              <TokenTrade
                tokenMint={selectedToken.tokenMint}
                tokenSymbol={selectedToken.symbol}
                tokenImage={selectedToken.image}
                compact
              />
            </div>
          </div>
        </div>
      )}

      {/* Launch Modal */}
      {showLaunchModal && (
        <TokenLaunch
          onClose={() => setShowLaunchModal(false)}
          onSuccess={(mint) => {
            setShowLaunchModal(false);
            fetchTokens();
            toast("success", "Your token is live!");
          }}
          username={useAppStore.getState().currentUser?.username}
        />
      )}
    </div>
  );
}
