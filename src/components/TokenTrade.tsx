"use client";

import { useState, useEffect } from "react";
import {
  ArrowUpDown,
  Loader2,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  ChevronDown,
  DollarSign,
  Info,
} from "lucide-react";
import { useWallet } from "@/hooks/usePrivyWallet";
import { toast } from "@/components/Toast";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { SOL_MINT, formatSOL } from "@/lib/bags";

interface TokenTradeProps {
  tokenMint: string;
  tokenSymbol: string;
  tokenImage?: string;
  onClose?: () => void;
  compact?: boolean; // Inline mode for profile
}

export default function TokenTrade({
  tokenMint,
  tokenSymbol,
  tokenImage,
  onClose,
  compact = false,
}: TokenTradeProps) {
  const { publicKey, signTransaction } = useWallet();
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState("");

  // Get a quote when amount changes
  useEffect(() => {
    if (!amount || Number(amount) <= 0) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      setQuoting(true);
      setError("");
      try {
        const inputMint = mode === "buy" ? SOL_MINT : tokenMint;
        const outputMint = mode === "buy" ? tokenMint : SOL_MINT;
        // Amount in smallest unit: SOL = lamports, token = typically 6 or 9 decimals
        const amountSmallest = mode === "buy"
          ? Math.floor(Number(amount) * 1e9) // SOL → lamports
          : Math.floor(Number(amount) * 1e6); // Token → smallest unit (assuming 6 decimals)

        const res = await fetch("/api/bags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "quote",
            inputMint,
            outputMint,
            amount: amountSmallest,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setQuote(data.response);
      } catch (err: any) {
        setError(err.message || "Failed to get quote");
        setQuote(null);
      }
      setQuoting(false);
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [amount, mode, tokenMint]);

  const handleTrade = async () => {
    if (!publicKey || !signTransaction || !quote) return;
    setLoading(true);
    setError("");

    try {
      // Create swap transaction
      const res = await fetch("/api/bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          quoteResponse: quote,
          userPublicKey: publicKey.toBase58(),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Sign the transaction with user wallet
      const tx = VersionedTransaction.deserialize(
        Buffer.from(data.response.unsignedTxBase64, "base64")
      );
      const signed = await signTransaction(tx);

      // Send to Solana
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      );
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      toast("success", `${mode === "buy" ? "Bought" : "Sold"} ${tokenSymbol} successfully! 🎉`);
      setAmount("");
      setQuote(null);
    } catch (err: any) {
      console.error("Trade error:", err);
      setError(err.message || "Trade failed");
      toast("error", err.message || "Trade failed");
    }
    setLoading(false);
  };

  const containerClass = compact
    ? "bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4"
    : "bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {tokenImage && (
            <img src={tokenImage} alt={tokenSymbol} className="w-6 h-6 rounded-full" />
          )}
          <span className="font-bold text-sm text-gray-900 dark:text-white">
            {mode === "buy" ? "Buy" : "Sell"} ${tokenSymbol}
          </span>
        </div>
        <a
          href={`https://bags.fm/${tokenMint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-purple-500 flex items-center gap-1"
        >
          Bags <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Buy/Sell Toggle */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 mb-3">
        <button
          onClick={() => { setMode("buy"); setAmount(""); setQuote(null); }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
            mode === "buy"
              ? "bg-green-500 text-white shadow"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setMode("sell"); setAmount(""); setQuote(null); }}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
            mode === "sell"
              ? "bg-red-500 text-white shadow"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">
          {mode === "buy" ? "Amount (SOL)" : `Amount (${tokenSymbol})`}
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step={mode === "buy" ? "0.01" : "1"}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <span className="absolute right-3 top-2.5 text-xs text-gray-400">
            {mode === "buy" ? "SOL" : tokenSymbol}
          </span>
        </div>
        {mode === "buy" && (
          <div className="flex gap-1.5 mt-1.5">
            {["0.1", "0.5", "1", "5"].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className="flex-1 py-1 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 transition"
              >
                {val} SOL
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quote Details */}
      {quoting && (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
          <span className="text-xs text-gray-400 ml-2">Getting quote...</span>
        </div>
      )}

      {quote && !quoting && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 mb-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">You {mode === "buy" ? "receive" : "get back"}</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {mode === "buy"
                ? `${(Number(quote.outAmount) / 1e6).toFixed(2)} ${tokenSymbol}`
                : `${formatSOL(quote.outAmount)} SOL`}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Price Impact</span>
            <span className={`font-medium ${Number(quote.priceImpactPct) > 3 ? "text-red-500" : "text-green-500"}`}>
              {Number(quote.priceImpactPct).toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Min. received</span>
            <span className="text-gray-600 dark:text-gray-400">
              {mode === "buy"
                ? `${(Number(quote.minOutAmount) / 1e6).toFixed(2)} ${tokenSymbol}`
                : `${formatSOL(quote.minOutAmount)} SOL`}
            </span>
          </div>
          {quote.routePlan?.length > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Route</span>
              <span className="text-gray-600 dark:text-gray-400">
                {quote.routePlan.map((leg: any) => leg.venue).join(" → ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={!quote || loading || !publicKey || quoting}
        className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
          mode === "buy"
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-red-500 hover:bg-red-600 text-white"
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {mode === "buy" ? "Buying..." : "Selling..."}
          </>
        ) : (
          <>
            {mode === "buy" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {mode === "buy" ? `Buy $${tokenSymbol}` : `Sell $${tokenSymbol}`}
          </>
        )}
      </button>

      {/* Bags Attribution */}
      <p className="text-center text-[10px] text-gray-400 mt-2">
        Trading powered by{" "}
        <a href="https://bags.fm" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
          Bags.fm
        </a>
      </p>
    </div>
  );
}
