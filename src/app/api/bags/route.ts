import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BagsSDK } from "@bagsfm/bags-sdk";

/**
 * /api/bags — Bags API proxy for token launch, trading, fees, and analytics.
 *
 * All Bags SDK calls happen server-side (API key is secret).
 * Frontend calls these routes and handles wallet signing.
 */

const BAGS_API_KEY = (process.env.BAGS_API_KEY || "").trim();
// Bags operates on Solana mainnet — use Helius mainnet RPC
const BAGS_RPC_URL = process.env.BAGS_MAINNET_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=7d359733-8771-4d20-af8c-54f756c96bb1";
// Bags config key (Meteora config key from Bags partner dashboard — NOT a wallet)
const BAGS_CONFIG_KEY = "B94bGwVuX7tWX8VkkyBZLmQESJ537URMcJcVkF8tdi5T";

function getSDK() {
  const connection = new Connection(BAGS_RPC_URL, "confirmed");
  return new BagsSDK(BAGS_API_KEY, connection, "confirmed");
}

function ok(data: any) {
  return NextResponse.json({ success: true, response: data });
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─── GET /api/bags?action=feed|creators|fees ───

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const sdk = getSDK();

    switch (action) {
      case "feed": {
        const feed = await sdk.bagsApiClient.get("/token-launch/feed");
        return ok(feed);
      }

      case "creators": {
        const mint = searchParams.get("mint");
        if (!mint) return err("Missing mint parameter");
        const creators = await sdk.state.getTokenCreators(new PublicKey(mint));
        return ok(
          creators.map((c: any) => ({
            wallet: c.wallet?.toString?.() || c.wallet,
            provider: c.provider,
            username: c.username,
            providerUsername: c.providerUsername,
            pfp: c.pfp,
            royaltyBps: c.royaltyBps,
            isCreator: c.isCreator,
            twitterUsername: c.twitterUsername,
            bagsUsername: c.bagsUsername,
          }))
        );
      }

      case "fees": {
        const wallet = searchParams.get("wallet");
        if (!wallet) return err("Missing wallet parameter");
        const positions = await sdk.fee.getAllClaimablePositions(new PublicKey(wallet));
        return ok(
          positions.map((p: any) => ({
            baseMint: p.baseMint,
            virtualPoolAddress: p.virtualPoolAddress,
            virtualPoolClaimableAmount: p.virtualPoolClaimableAmount?.toString(),
            dammPoolClaimableAmount: p.dammPoolClaimableAmount?.toString(),
            isCustomFeeVault: p.isCustomFeeVault,
            customFeeVaultBalance: p.customFeeVaultBalance?.toString(),
            customFeeVaultBps: p.customFeeVaultBps,
            customFeeVaultClaimerSide: p.customFeeVaultClaimerSide,
            totalClaimableLamportsUserShare: p.totalClaimableLamportsUserShare?.toString(),
            isMigrated: p.isMigrated,
          }))
        );
      }

      case "lifetime-fees": {
        const mint = searchParams.get("mint");
        if (!mint) return err("Missing mint parameter");
        const fees = await sdk.state.getTokenLifetimeFees(new PublicKey(mint));
        return ok({ lifetimeFees: fees });
      }

      case "top-tokens": {
        const tokens = await sdk.state.getTopTokensByLifetimeFees();
        return ok(tokens);
      }

      default:
        return err("Unknown action. Use: feed, creators, fees, lifetime-fees, top-tokens");
    }
  } catch (error: any) {
    console.error("[Bags GET]", error);
    return err(error.message || "Internal error", 500);
  }
}

// ─── POST /api/bags ───

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const sdk = getSDK();

    switch (action) {
      // ──── Create token metadata + get info ────
      case "create-token-info": {
        const { name, symbol, description, imageUrl, twitter, website } = body;
        if (!name || !symbol || !description || !imageUrl) {
          return err("Missing required fields: name, symbol, description, imageUrl");
        }

        const result = await sdk.tokenLaunch.createTokenInfoAndMetadata({
          imageUrl,
          name,
          description,
          symbol: symbol.toUpperCase().replace("$", ""),
          twitter: twitter || undefined,
          website: website || undefined,
        });

        return ok({
          tokenMint: result.tokenMint,
          metadataUrl: result.tokenMetadata,
          tokenLaunch: result.tokenLaunch,
        });
      }

      // ──── Create launch transaction (unsigned, for frontend signing) ────
      case "create-launch-tx": {
        const { metadataUrl, tokenMint, launchWallet, initialBuyLamports, configKey } = body;
        if (!metadataUrl || !tokenMint || !launchWallet) {
          return err("Missing required fields");
        }

        const tx = await sdk.tokenLaunch.createLaunchTransaction({
          metadataUrl,
          tokenMint: new PublicKey(tokenMint),
          launchWallet: new PublicKey(launchWallet),
          initialBuyLamports: initialBuyLamports || 0,
          configKey: new PublicKey(configKey || BAGS_CONFIG_KEY),
        });

        // Serialize the unsigned transaction for the frontend to sign
        const serialized = Buffer.from(tx.serialize()).toString("base64");
        return ok({ unsignedTxBase64: serialized });
      }

      // ──── Get trade quote ────
      case "quote": {
        const { inputMint, outputMint, amount, slippageMode, slippageBps } = body;
        if (!inputMint || !outputMint || !amount) {
          return err("Missing required fields: inputMint, outputMint, amount");
        }

        const quote = await sdk.trade.getQuote({
          inputMint: new PublicKey(inputMint),
          outputMint: new PublicKey(outputMint),
          amount: Number(amount),
          slippageMode: slippageMode || "auto",
          slippageBps: slippageBps ? Number(slippageBps) : undefined,
        });

        return ok(quote);
      }

      // ──── Create swap transaction ────
      case "swap": {
        const { quoteResponse, userPublicKey } = body;
        if (!quoteResponse || !userPublicKey) {
          return err("Missing quoteResponse or userPublicKey");
        }

        const result = await sdk.trade.createSwapTransaction({
          quoteResponse,
          userPublicKey: new PublicKey(userPublicKey),
        });

        const serialized = Buffer.from(result.transaction.serialize()).toString("base64");
        return ok({
          unsignedTxBase64: serialized,
          computeUnitLimit: result.computeUnitLimit,
          lastValidBlockHeight: result.lastValidBlockHeight,
          prioritizationFeeLamports: result.prioritizationFeeLamports,
        });
      }

      // ──── Create fee claim transactions ────
      case "claim": {
        const { walletAddress, tokenMint } = body;
        if (!walletAddress || !tokenMint) {
          return err("Missing walletAddress or tokenMint");
        }

        const txs = await sdk.fee.getClaimTransactions(
          new PublicKey(walletAddress),
          new PublicKey(tokenMint)
        );

        const serialized = txs.map((tx: any) => ({
          unsignedTxBase64: Buffer.from(tx.serialize()).toString("base64"),
        }));
        return ok(serialized);
      }

      // ──── Get or create fee share config ────
      case "create-config": {
        const { payerWallet, tokenMint, feeClaimers } = body;
        if (!payerWallet || !tokenMint) {
          return err("Missing payerWallet or tokenMint");
        }

        // Build fee share config (partner fee sharing via BAGS_CONFIG_KEY in launch tx)
        const configResult = await sdk.config.createBagsFeeShareConfig({
          payer: new PublicKey(payerWallet),
          baseMint: new PublicKey(tokenMint),
          feeClaimers: (feeClaimers || []).map((fc: any) => ({
            user: new PublicKey(fc.wallet),
            userBps: fc.bps,
          })),
        });

        const transactions = (configResult.transactions || []).map((tx: any) =>
          Buffer.from(tx.serialize()).toString("base64")
        );
        const bundles = (configResult.bundles || []).map((bundle: any) =>
          bundle.map((tx: any) => Buffer.from(tx.serialize()).toString("base64"))
        );

        return ok({
          configKey: configResult.meteoraConfigKey?.toString(),
          transactions,
          bundles,
        });
      }

      default:
        return err("Unknown action");
    }
  } catch (error: any) {
    console.error("[Bags POST]", error);
    return err(error.message || "Internal error", 500);
  }
}
