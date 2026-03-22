# Shyft — Private Social on Solana with MagicBlock TEE

> **Live:** [https://www.shyft.lol](https://www.shyft.lol)  
> **Program ID:** `EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ`  
> **Network:** Solana Devnet

Shyft is a privacy-first social platform built on Solana where posts, messages, and payment records are protected using **MagicBlock's Trusted Execution Environment (TEE)** and the **Ephemeral Rollups SDK**. Users can create profiles, share posts (public or private), chat with friends, and send SOL payments — all with on-chain privacy guarantees enforced at the hardware level.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [MagicBlock Integration — Where & How](#magicblock-integration--where--how)
- [On-Chain Program (Rust/Anchor)](#on-chain-program-rustanchor)
- [Frontend (Next.js)](#frontend-nextjs)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Tech Stack](#tech-stack)

---

## Features

| Feature | Description | MagicBlock Used? |
|---------|-------------|:----------------:|
| **User Profiles** | On-chain profile with username, display name, bio | ✅ Privacy toggle via permission |
| **Feed (Posts)** | Public and private posts, likes | ✅ Post delegation + permission |
| **Friends** | On-chain friend list, mutual friend detection | — |
| **Private Chat** | 1:1 encrypted messaging between friends | ✅ Permission + message delegation |
| **In-Chat Payments** | Send SOL to friends directly from chat | ✅ Payment message delegation |
| **Payment Records** | On-chain payment history with TEE protection | ✅ Message PDA delegation |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  shyft.lol — React, TailwindCSS, Solana Wallet Adapter          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐  │
│  │    Feed      │  │    Chat     │  │  Payments   │  │Profile │  │
│  │  (Posts)     │  │ (Messages)  │  │ (SOL xfer)  │  │(Setup) │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───┬────┘  │
│         │                │                │              │       │
│         ▼                ▼                ▼              ▼       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              ShyftClient (src/lib/program.ts)            │    │
│  │  Anchor RPC calls + MagicBlock permission/delegation     │    │
│  └────────────────────────┬─────────────────────────────────┘    │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Solana Devnet                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │         Shadowspace Program (Anchor/Rust)                │    │
│  │  EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ          │    │
│  │                                                          │    │
│  │  Instructions:                                           │    │
│  │  • create_profile    • create_post    • like_post        │    │
│  │  • create_chat       • send_message                      │    │
│  │  • create_friend_list • add_friend   • remove_friend     │    │
│  │  • delegate_pda      • create_permission • undelegate    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐   │
│  │  Permission Program │  │     Delegation Program           │   │
│  │  ACLseoPoyC3cBqoUtk │  │     DELeGGvXpWV2fqJUhqcF5ZS     │   │
│  │  (Access Control)   │  │     (TEE Delegation)             │   │
│  └─────────────────────┘  └──────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              MagicBlock TEE Validator                     │    │
│  │  FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA          │    │
│  │  Intel TDX hardware-level privacy                        │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## MagicBlock Integration — Where & How

MagicBlock is used throughout the application for **privacy and access control**. Here is every integration point:

### 1. Ephemeral Rollups SDK (Rust Program)

**File:** `programs/shadowspace/src/lib.rs`

The Solana program uses the `ephemeral-rollups-sdk` (v0.8.0) with both `anchor` and `access-control` features:

```rust
use ephemeral_rollups_sdk::access_control::instructions::{
    CreatePermissionCpiBuilder, UpdatePermissionCpiBuilder,
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
```

**Key program instructions that use MagicBlock:**

| Instruction | What it does | MagicBlock Feature |
|-------------|-------------|-------------------|
| `create_permission` | Creates a permission on any PDA, restricting who can read/write it inside the TEE. Uses `CreatePermissionCpiBuilder` to CPI into MagicBlock's Permission Program. | **Access Control** |
| `delegate_pda` | Delegates any PDA to the MagicBlock TEE validator. The account's owner changes to the Delegation Program, and data lives inside Intel TDX hardware. | **TEE Delegation** |
| `update_profile_privacy` | Toggles profile privacy using `UpdatePermissionCpiBuilder`. When private, only the owner's pubkey is in the members list. | **Access Control** |
| `undelegate` | Commits state and undelegates accounts back to Solana using `commit_and_undelegate_accounts`. | **Commit & Undelegate** |

The `#[ephemeral]` macro is applied to the entire program module, enabling MagicBlock's ephemeral rollup functionality.

### 2. Post Delegation (Feed)

**Files:** `src/components/Feed.tsx`, `src/lib/program.ts`

When a user creates a post:

1. **Post PDA created** on-chain via `create_post`
2. **MagicBlock permission created** on the post PDA — restricts read access to friends (for private posts) or public
3. **Post PDA delegated to TEE** via `delegate_pda` — the post data moves into the MagicBlock TEE validator

```
User creates post → Permission created → PDA delegated to TEE
```

The feed loads both regular posts (from our program) and delegated posts (from the Delegation Program at `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`), then decodes and merges them. Delegated posts show a purple "TEE" badge.

**Relevant code in `program.ts`:**
- `createPostFull()` — Creates post + permission + delegates to TEE
- `getAllPostsIncludingDelegated()` — Fetches posts from both our program and the delegation program, decodes with BorshCoder

### 3. Chat Permission & Message Delegation

**Files:** `src/components/Chat.tsx`, `src/lib/program.ts`

When a user opens a chat with a friend:

1. **Chat PDA created** on-chain via `create_chat`
2. **MagicBlock permission created** on the chat PDA — restricts access to only the two chat participants (both get `AUTHORITY | TX_LOGS | TX_BALANCES` flags = 7)

When a message is sent:

3. **Message PDA created** on-chain via `send_message`
4. **MagicBlock permission created** on the message PDA — same two-participant restriction
5. **Message PDA delegated to TEE** via `delegate_pda` — the message data moves into Intel TDX hardware

```
Create chat → Permission (2 members) → Send message → Permission on msg → Delegate msg to TEE
```

**Design decision:** The chat PDA itself is NOT delegated — only permissioned. This is because the `send_message` instruction needs to write to the chat PDA (incrementing `message_count`), and a delegated account's owner changes to the Delegation Program, which would cause Anchor to reject the write. Instead, each **individual message** is delegated to TEE independently.

**Relevant code in `program.ts`:**
- `sendMessage()` — Sends message on-chain, then creates permission + delegates message PDA to TEE
- `createPermission()` — CPI wrapper for MagicBlock's permission program
- `delegateAccount()` — CPI wrapper for MagicBlock's delegation program
- `getMessagesForChat()` — Fetches messages from both our program and delegated accounts (589 bytes), decodes with BorshCoder

### 4. In-Chat Payments

**Files:** `src/components/Chat.tsx`, `src/hooks/usePrivatePayment.ts`, `src/lib/program.ts`

When a user sends SOL to a friend from chat:

1. **SOL transferred** directly via `SystemProgram.transfer` on Solana
2. **Payment message recorded** on-chain via `send_message` with `is_payment: true`
3. **Payment message PDA delegated to TEE** — the record of who sent how much to whom is protected inside the TEE

The payment record (message PDA) goes through the same MagicBlock permission + delegation flow as regular messages, so the payment details are only visible to the two chat participants.

### 5. Profile Privacy

**File:** `programs/shadowspace/src/lib.rs`

The `update_profile_privacy` instruction uses MagicBlock's `UpdatePermissionCpiBuilder` to toggle profile visibility:

- **Private mode:** Updates permission members to only include the owner's pubkey
- **Public mode:** Sets members to `None` (publicly readable)

### 6. Delegated Account Fetching

**File:** `src/lib/program.ts`

The client intelligently fetches data from both the main program and the MagicBlock Delegation Program:

- **Posts (589 bytes):** `getProgramAccounts(DELEGATION_PROGRAM_ID, { filters: [{ dataSize: 589 }] })` — fetches all delegated 589-byte accounts, then tries to decode as `Post`
- **Messages (589 bytes):** Same filter, but decoded as `Message` and filtered by `chatId`
- **Chats (96 bytes):** For each friend, derives the expected chat PDA and checks if it exists in the delegation program via `getAccountInfo`

All delegated accounts are decoded using Anchor's `BorshCoder` with the program's IDL.

### Summary of MagicBlock Programs Used

| Program | Address | Purpose |
|---------|---------|---------|
| **Permission Program** | `ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1` | Access control — restricts who can read/write PDAs |
| **Delegation Program** | `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh` | Delegates PDAs to TEE validator |
| **Magic Program** | `Magic11111111111111111111111111111111111111` | Core MagicBlock system program |
| **Magic Context** | `MagicContext1111111111111111111111111111111` | Ephemeral context for commit/undelegate |
| **TEE Validator** | `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA` | Intel TDX hardware validator |

---

## On-Chain Program (Rust/Anchor)

**Location:** `programs/shadowspace/src/lib.rs`

### Account Types (PDAs)

| Account | Seeds | Size | Description |
|---------|-------|------|-------------|
| **Profile** | `["profile", user_pubkey]` | 417 bytes | User profile with username, bio, privacy |
| **Post** | `["post", author_pubkey, post_id_le]` | 589 bytes | Post with content, likes, privacy flag |
| **Chat** | `["chat", chat_id_le]` | 96 bytes | Chat room between two users |
| **Message** | `["message", chat_id_le, msg_index_le]` | 589 bytes | Individual chat message |
| **FriendList** | `["friends", user_pubkey]` | 1636 bytes | List of up to 50 friend pubkeys |

### Instructions

| Instruction | Description |
|-------------|-------------|
| `create_profile` | Initialize profile PDA |
| `update_profile_privacy` | Toggle privacy with MagicBlock permission |
| `create_post` | Create a post, increment author's post_count |
| `like_post` | Increment post's like counter |
| `create_chat` | Create chat room between two users |
| `send_message` | Send message, increment chat's message_count |
| `create_friend_list` | Initialize friend list PDA |
| `add_friend` | Add pubkey to friend list |
| `remove_friend` | Remove pubkey from friend list |
| `create_permission` | Create MagicBlock permission on any PDA |
| `delegate_pda` | Delegate any PDA to TEE validator |
| `undelegate` | Commit & undelegate account back to Solana |

### AccountType Enum

Used by `create_permission` and `delegate_pda` to derive the correct PDA seeds:

```rust
pub enum AccountType {
    Profile { owner: Pubkey },
    Post { author: Pubkey, post_id: u64 },
    Chat { chat_id: u64 },
    Message { chat_id: u64, message_index: u64 },
    FriendList { owner: Pubkey },
}
```

---

## Frontend (Next.js)

### Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `page.tsx` | Main app — shows Landing (pre-connect) or tabbed UI (post-connect) |
| `/api/magicblock` | `route.ts` | API proxy for MagicBlock endpoints |

### Core Components

| Component | File | Description |
|-----------|------|-------------|
| **Feed** | `src/components/Feed.tsx` | Public + private post feed with TEE badges |
| **Chat** | `src/components/Chat.tsx` | Friend-based 1:1 messaging with MagicBlock |
| **Payments** | `src/components/Payments.tsx` | SOL payment UI with status tracking |
| **Profile** | `src/components/Profile.tsx` | Profile setup and friend management |
| **ProfileSetup** | `src/components/ProfileSetup.tsx` | First-time profile creation |
| **Landing** | `src/components/Landing.tsx` | Pre-connect landing page |
| **OnboardingDemo** | `src/components/OnboardingDemo.tsx` | First-time user walkthrough |
| **Header** | `src/components/Header.tsx` | App header with wallet connection |
| **Sidebar** | `src/components/Sidebar.tsx` | Desktop navigation |
| **MobileNav** | `src/components/MobileNav.tsx` | Mobile bottom navigation |

### Key Libraries

| File | Purpose |
|------|---------|
| `src/lib/program.ts` | **ShyftClient** — All Solana + MagicBlock RPC interactions |
| `src/lib/store.ts` | Zustand global state store |
| `src/lib/magicblock.ts` | MagicBlock API helpers |
| `src/lib/constants.ts` | Program IDs, TEE URLs |
| `src/lib/idl.json` | Anchor IDL for the program |
| `src/hooks/useProgram.ts` | React hook for ShyftClient |
| `src/hooks/usePrivatePayment.ts` | SOL payment hook |
| `src/contexts/WalletProvider.tsx` | Solana wallet adapter setup |

---

## Project Structure

```
shadowspace/
├── programs/shadowspace/
│   ├── Cargo.toml                 # Rust dependencies (anchor, ephemeral-rollups-sdk)
│   └── src/lib.rs                 # Solana program — all instructions & accounts
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with WalletProvider
│   │   ├── page.tsx               # Main page with tab routing
│   │   ├── globals.css            # TailwindCSS styles
│   │   └── api/magicblock/
│   │       └── route.ts           # API proxy for MagicBlock
│   ├── components/
│   │   ├── Feed.tsx               # Post feed (public + private + delegated)
│   │   ├── Chat.tsx               # 1:1 messaging with friends
│   │   ├── Payments.tsx           # Payment UI
│   │   ├── Profile.tsx            # Profile & friend management
│   │   ├── ProfileSetup.tsx       # Onboarding profile creation
│   │   ├── Landing.tsx            # Pre-connect landing
│   │   ├── Header.tsx             # App header
│   │   ├── Sidebar.tsx            # Desktop nav
│   │   ├── MobileNav.tsx          # Mobile nav
│   │   ├── OnboardingDemo.tsx     # First-time walkthrough
│   │   └── Toast.tsx              # Toast notification system
│   ├── contexts/
│   │   └── WalletProvider.tsx     # Solana wallet adapter
│   ├── hooks/
│   │   ├── useProgram.ts          # ShyftClient hook
│   │   └── usePrivatePayment.ts   # SOL payment hook
│   ├── lib/
│   │   ├── program.ts             # ShyftClient — main program interaction layer
│   │   ├── store.ts               # Zustand state management
│   │   ├── magicblock.ts          # MagicBlock API utilities
│   │   ├── constants.ts           # Program IDs, URLs
│   │   └── idl.json               # Anchor IDL
│   └── types/
│       └── index.ts               # TypeScript interfaces
├── target/
│   ├── deploy/
│   │   └── shadowspace-keypair.json
│   ├── idl/shadowspace.json       # Generated IDL
│   └── types/shadowspace.ts       # Generated types
├── Anchor.toml                    # Anchor config (devnet)
├── Cargo.toml                     # Workspace Cargo config
├── package.json                   # Node.js dependencies
├── next.config.ts                 # Next.js configuration
├── tsconfig.json                  # TypeScript configuration
└── postcss.config.mjs             # PostCSS/Tailwind config
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Rust** + **Anchor CLI** 0.32.1
- **Solana CLI** with devnet configured
- A Solana wallet (Phantom, Solflare, etc.)

### 1. Clone & Install

```bash
git clone <repo-url>
cd shadowspace
npm install
```

### 2. Build the Solana Program

```bash
anchor build
```

The program is already deployed to devnet at `EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ`.

### 3. Run the Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Connect Wallet

1. Switch your wallet to **Solana Devnet**
2. Get devnet SOL from a faucet: `solana airdrop 2`
3. Connect your wallet on the landing page
4. Create your profile
5. Start posting, adding friends, and chatting!

---

## Deployment

### Frontend (Vercel)

```bash
npx vercel --prod
```

The app is deployed at [https://www.shyft.lol](https://www.shyft.lol).

### Solana Program

```bash
anchor build
anchor deploy --provider.cluster devnet
```

Program ID: `EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Blockchain** | Solana (Devnet) |
| **Smart Contract** | Anchor 0.32.1 (Rust) |
| **Privacy** | MagicBlock Ephemeral Rollups SDK 0.8.0 |
| **TEE Hardware** | Intel TDX via MagicBlock |
| **Frontend** | Next.js 16.1.7 (React 19, Turbopack) |
| **Styling** | Tailwind CSS 4.2 |
| **Wallet** | Solana Wallet Adapter |
| **State** | Zustand 5.0 |
| **Icons** | Lucide React |
| **Deployment** | Vercel |

---

## How Privacy Works

1. **Permission-based access control:** Every sensitive PDA (posts, messages, profiles) gets a MagicBlock permission that specifies exactly which pubkeys can read/write the data. This is enforced at the hardware level inside Intel TDX.

2. **TEE Delegation:** After creating an account and setting permissions, the PDA is delegated to MagicBlock's TEE validator. The account's owner changes to the Delegation Program, and the actual data lives inside the Trusted Execution Environment — invisible to validators, RPC nodes, or anyone without permission.

3. **Dual fetching:** The frontend fetches data from both the main program (non-delegated accounts) and the Delegation Program (delegated accounts), decodes both with the same IDL, and merges results. Users see a seamless experience with TEE/on-chain badges indicating where their data lives.

4. **Friend-only visibility:** Private posts are only shown to mutual friends. Chat messages are permissioned to only the two participants. Payment records are delegated to TEE so transaction details are hardware-protected.

---

## License

ISC
