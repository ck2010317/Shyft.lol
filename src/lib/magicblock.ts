import { Connection, Transaction } from "@solana/web3.js";
import { MAGICBLOCK_TEE_URL } from "./constants";

export interface DepositParams {
  payer: string;
  user: string;
  mint: string;
  amount: number;
  validator?: string;
}

export interface TransferParams {
  sender: string;
  recipient: string;
  mint: string;
  amount: number;
}

export interface PrepareWithdrawalParams {
  user: string;
  mint: string;
}

export interface WithdrawParams {
  owner: string;
  user: string;
  mint: string;
  amount: number;
}

async function proxyCall(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch("/api/magicblock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, body }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || data?.detail || `API error: ${response.status}`);
  }
  return data;
}

export async function getConfig() {
  const response = await fetch("/api/magicblock");
  return response.json();
}

export async function createDepositTransaction(params: DepositParams): Promise<string> {
  const data = await proxyCall("/private/tx/deposit", params as unknown as Record<string, unknown>);
  return data.transaction;
}

export async function createTransferTransaction(params: TransferParams): Promise<string> {
  const data = await proxyCall("/private/tx/transfer-amount", params as unknown as Record<string, unknown>);
  return data.transaction;
}

export async function createPrepareWithdrawalTransaction(params: PrepareWithdrawalParams): Promise<string> {
  const data = await proxyCall("/private/tx/prepare-withdrawal", params as unknown as Record<string, unknown>);
  return data.transaction;
}

export async function createWithdrawTransaction(params: WithdrawParams): Promise<string> {
  const data = await proxyCall("/private/tx/withdraw", params as unknown as Record<string, unknown>);
  return data.transaction;
}

export function deserializeTransaction(base64Tx: string): Transaction {
  const buffer = Buffer.from(base64Tx, "base64");
  return Transaction.from(buffer);
}

export async function getTeeConnection(authToken: string): Promise<Connection> {
  const url = `${MAGICBLOCK_TEE_URL}?token=${authToken}`;
  return new Connection(url, {
    wsEndpoint: `wss://tee.magicblock.app?token=${authToken}`,
    commitment: "confirmed",
  });
}

export async function sendPrivatePayment(
  connection: Connection,
  senderPubkey: string,
  recipientPubkey: string,
  mint: string,
  amount: number,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<{ depositSig: string; transferSig: string }> {
  // Step 1: Create and sign deposit transaction
  const depositTxBase64 = await createDepositTransaction({
    payer: senderPubkey,
    user: senderPubkey,
    mint,
    amount,
  });
  const depositTx = deserializeTransaction(depositTxBase64);
  const signedDeposit = await signTransaction(depositTx);
  const depositSig = await connection.sendRawTransaction(signedDeposit.serialize());
  await connection.confirmTransaction(depositSig, "confirmed");

  // Step 2: Create and sign transfer transaction (sent to TEE)
  const transferTxBase64 = await createTransferTransaction({
    sender: senderPubkey,
    recipient: recipientPubkey,
    mint,
    amount,
  });
  const transferTx = deserializeTransaction(transferTxBase64);
  const signedTransfer = await signTransaction(transferTx);
  const transferSig = await connection.sendRawTransaction(signedTransfer.serialize());
  await connection.confirmTransaction(transferSig, "confirmed");

  return { depositSig, transferSig };
}
