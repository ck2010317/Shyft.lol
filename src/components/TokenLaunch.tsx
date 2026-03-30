"use client";

import { useState } from "react";
import {
  Rocket,
  Coins,
  X,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  Upload,
  DollarSign,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useWallet } from "@/hooks/usePrivyWallet";
import { toast } from "@/components/Toast";
import { uploadImage } from "@/components/RichContent";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { BAGS_PARTNER_CONFIG_KEY, BAGS_REF_CODE } from "@/lib/bags";

interface TokenLaunchProps {
  onClose: () => void;
  onSuccess?: (tokenMint: string) => void;
  username?: string;
}

export default function TokenLaunch({ onClose, onSuccess, username }: TokenLaunchProps) {
  const { publicKey, signTransaction } = useWallet();
  const [step, setStep] = useState<"form" | "creating" | "launching" | "success">("form");
  const [name, setName] = useState(username ? `${username}` : "");
  const [symbol, setSymbol] = useState(username ? username.toUpperCase().slice(0, 6) : "");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [twitter, setTwitter] = useState("");
  const [website, setWebsite] = useState("");
  const [initialBuy, setInitialBuy] = useState("0");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [result, setResult] = useState<{ tokenMint: string; metadataUrl: string } | null>(null);
  const [error, setError] = useState("");

  const handleImageSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setUploadingImage(true);
    setError("");
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
    } catch (err: any) {
      setError("Failed to upload image. Try again.");
      setImageFile(null);
    }
    setUploadingImage(false);
  };

  const handleLaunch = async () => {
    if (!publicKey || !signTransaction) {
      toast("error", "Connect your wallet first");
      return;
    }
    if (!name || !symbol || !description || !imageUrl) {
      setError("Please fill in all required fields");
      return;
    }

    setError("");
    setStep("creating");

    try {
      // Step 1: Create token info + metadata via Bags API
      const infoRes = await fetch("/api/bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-token-info",
          name,
          symbol,
          description,
          imageUrl,
          twitter: twitter || undefined,
          website: website || undefined,
        }),
      });
      const infoData = await infoRes.json();
      if (!infoData.success) throw new Error(infoData.error || "Failed to create token info");

      const { tokenMint, metadataUrl } = infoData.response;
      toast("success", "Token metadata created!");

      // Step 2: Create fee share config with Shyft partner
      setStep("launching");

      const configRes = await fetch("/api/bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-config",
          payerWallet: publicKey.toBase58(),
          tokenMint,
          feeClaimers: [
            { wallet: publicKey.toBase58(), bps: 10000 }, // Creator gets all remaining fees
          ],
        }),
      });
      const configData = await configRes.json();
      if (!configData.success) throw new Error(configData.error || "Failed to create fee config");

      // Sign and send config transactions if any
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      );

      for (const txBase64 of configData.response.transactions || []) {
        const tx = VersionedTransaction.deserialize(Buffer.from(txBase64, "base64"));
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, "confirmed");
      }

      // Step 3: Create launch transaction
      const launchRes = await fetch("/api/bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-launch-tx",
          metadataUrl,
          tokenMint,
          launchWallet: publicKey.toBase58(),
          initialBuyLamports: Math.floor(Number(initialBuy) * 1e9),
          configKey: configData.response.configKey,
        }),
      });
      const launchData = await launchRes.json();
      if (!launchData.success) throw new Error(launchData.error || "Failed to create launch tx");

      // Sign and send launch transaction
      const launchTx = VersionedTransaction.deserialize(
        Buffer.from(launchData.response.unsignedTxBase64, "base64")
      );
      const signedLaunch = await signTransaction(launchTx);
      const launchSig = await connection.sendRawTransaction(signedLaunch.serialize());
      await connection.confirmTransaction(launchSig, "confirmed");

      setResult({ tokenMint, metadataUrl });
      setStep("success");
      toast("success", "Token launched successfully! 🚀");
      onSuccess?.(tokenMint);
    } catch (err: any) {
      console.error("Token launch error:", err);
      setError(err.message || "Failed to launch token");
      setStep("form");
      toast("error", err.message || "Launch failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Launch Creator Token</h2>
              <p className="text-xs text-gray-500">Powered by Bags.fm</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Success State */}
        {step === "success" && result && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Token Launched! 🎉</h3>
            <p className="text-sm text-gray-500 mb-4">Your creator token is now live on Solana</p>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Token Mint</span>
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  {result.tokenMint.slice(0, 8)}...{result.tokenMint.slice(-8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Symbol</span>
                <span className="text-sm font-bold text-purple-600">${symbol}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={`https://bags.fm/${result.tokenMint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 text-white rounded-xl font-medium text-sm hover:bg-purple-700 transition"
              >
                View on Bags <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Loading States */}
        {(step === "creating" || step === "launching") && (
          <div className="p-6 text-center">
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {step === "creating" ? "Creating Token Metadata..." : "Launching Token..."}
            </h3>
            <p className="text-sm text-gray-500">
              {step === "creating"
                ? "Setting up your token on Bags.fm"
                : "Deploying to Solana — please approve the transaction"}
            </p>
          </div>
        )}

        {/* Form */}
        {step === "form" && (
          <div className="p-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}

            {/* Token Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Token Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shaan Token"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Symbol *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="e.g. SHAAN"
                  maxLength={6}
                  className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell people about your token..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Token Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Token Image *
              </label>
              {imageUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border-2 border-purple-300 dark:border-purple-600 overflow-hidden shrink-0">
                    <img src={imageUrl} alt="Token" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{imageFile?.name || "Image uploaded"}</p>
                    <button
                      type="button"
                      onClick={() => { setImageUrl(""); setImageFile(null); }}
                      className="text-xs text-red-500 hover:text-red-600 mt-1"
                    >
                      Remove & choose another
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageSelect(file);
                    }}
                  />
                  {uploadingImage ? (
                    <>
                      <Loader2 className="w-6 h-6 text-purple-500 animate-spin mb-1" />
                      <span className="text-xs text-gray-500">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-sm text-gray-500">Click to upload image</span>
                      <span className="text-xs text-gray-400 mt-0.5">PNG, JPG, GIF — max 5MB</span>
                    </>
                  )}
                </label>
              )}
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Twitter (optional)</label>
                <input
                  type="url"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://x.com/..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Website (optional)</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Initial Buy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Buy (SOL) — optional
              </label>
              <p className="text-xs text-gray-400 mb-2">Buy some of your own token at launch. Set to 0 if you don't want to.</p>
              <div className="relative">
                <input
                  type="number"
                  value={initialBuy}
                  onChange={(e) => setInitialBuy(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-2.5 text-gray-400 text-sm">SOL</span>
              </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
              <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
              <div className="text-xs text-purple-700 dark:text-purple-300">
                <p className="font-medium mb-0.5">How it works</p>
                <p>Your token launches on Bags.fm with a bonding curve. When people trade your token, you earn fees forever. Shyft takes a 25% platform fee on trading revenue.</p>
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={handleLaunch}
              disabled={!name || !symbol || !description || !imageUrl || !publicKey}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-sm hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              Launch Token on Bags
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
