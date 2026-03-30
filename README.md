# Shyft — On-Chain Social Platform on Solana

> **Live:** [https://www.shyft.lol](https://www.shyft.lol)  
> **Program ID:** `EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ`  
> **Network:** Solana Devnet

Shyft is the first fully on-chain social platform built on Solana. Every post, comment, like, reaction, follow, repost, and chat message is a Solana transaction — stored permanently on-chain. Users sign in with Privy embedded wallets (email/social login), interact gaslessly via treasury sponsorship, and never need to own or pay any SOL. The platform founder sponsors all gas and rent costs.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Zero-Cost Onboarding (Treasury Sponsorship)](#zero-cost-onboarding-treasury-sponsorship)
- [On-Chain Data](#on-chain-data)
- [E2E Encrypted Chat](#e2e-encrypted-chat)
- [Real-Time Notifications](#real-time-notifications)
- [Clickable Profiles & Hover Cards](#clickable-profiles--hover-cards)
- [Dark / Light Theme](#dark--light-theme)
- [On-Chain Program (Rust/Anchor)](#on-chain-program-rustanchor)
- [Backend API Routes](#backend-api-routes)
- [Frontend (Next.js)](#frontend-nextjs)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Tech Stack](#tech-stack)

---

## Features

| Feature | Description | On-Chain? |
|---------|-------------|:---------:|
| **User Profiles** | Username, display name, bio, avatar, banner — stored on Solana | ✅ |
| **Posts** | Create text posts with images, GIFs, links — stored on Solana | ✅ |
| **Comments** | Comment on any post — each comment is a separate PDA | ✅ |
| **Likes** | Like any post — increments an on-chain counter | ✅ |
| **Reactions** | React with ❤️ 🔥 🚀 😂 👏 💡 — each reaction is a PDA | ✅ |
| **Reposts** | Repost anyone's content — creates a new on-chain post with `RT\|@author\|content` | ✅ |
| **Follows** | Follow/unfollow users — on-chain follow accounts with follower/following counters | ✅ |
| **E2E Encrypted Chat** | 1:1 P2P messaging with NaCl Box (X25519-XSalsa20-Poly1305) — ciphertext stored on-chain, only sender/receiver can decrypt | ✅ |
| **In-Chat Payments** | Send SOL to friends directly from chat | ✅ |
| **Treasury Sponsorship** | Platform treasury pays ALL gas fees and rent — users never need SOL | ✅ |
| **Zero-Cost Onboarding** | New users sign in → create profile → start posting. Zero SOL required. Treasury sponsors everything via `/api/sponsor-tx` | ✅ |
| **Real-Time Notifications** | Bell icon with live alerts for likes, comments, reactions, reposts, follows (5s polling) | Polling |
| **Clickable Profiles** | Click any username or avatar to view that user's profile (like X/Twitter) | — |
| **Profile Hover Cards** | Hover over any username to see a popup card with avatar, bio, follower/following count | — |
| **Dark / Light Theme** | Night Mode (dark) and Day Mode (light) toggle — persisted across sessions | — |
| **Live Feed Auto-Refresh** | Feed auto-refreshes every 8 seconds — new posts, live like counts, comments, reactions | — |
| **Share** | Share any post — copies a shyft.lol link to clipboard, or uses native share on mobile | — |
| **Wallet Management** | View balance, QR code, export private key, fund via explorer | — |
| **Gold Badges** | OG/founder verification badges (gold gradient for @shaan) on profiles and posts | — |
| **Image Uploads** | Upload images directly in posts via ImgBB hosting | — |
| **Rich Content** | Auto-detect URLs, images, YouTube embeds, GIFs in posts | — |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 16)                         │
│              shyft.lol — React 19, TailwindCSS 4                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐  │
│  │  Feed    │ │  Chat    │ │ Payments │ │ Profile │ │ Notifs │  │
│  │ Posts    │ │ Messages │ │ SOL xfer │ │ View    │ │ Bell   │  │
│  │ Comments │ │          │ │          │ │ Others  │ │ Panel  │  │
│  │ Reactions│ │          │ │          │ │ Follow  │ │        │  │
│  │ Reposts  │ │          │ │          │ │ Wallet  │ │        │  │
│  │ Hover📇 │ │          │ │          │ │ Export  │ │        │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ └───┬────┘  │
│       │            │            │             │          │       │
│       ▼            ▼            ▼             ▼          ▼       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │           ShyftClient (src/lib/program.ts)               │    │
│  │    Anchor RPC · Treasury Sponsorship · E2E Encryption    │    │
│  └────────────────────────┬───────────────────────────────┘    │
│                           │                                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │        Treasury Sponsorship API (Next.js API Route)      │    │
│  │  /api/sponsor-tx — Treasury co-signs as fee payer        │    │
│  │  Treasury pays ALL gas fees + rent — user never pays     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │        Privy Embedded Wallets (@privy-io/react-auth)     │    │
│  │  Email/Social login · Solana wallet · Export private key  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │       Theme System (ThemeProvider + CSS variables)        │    │
│  │  data-theme="light"|"dark" on <html> · 200ms transitions │    │
│  │  Persisted in localStorage via Zustand                    │    │
│  └──────────────────────────────────────────────────────────┘    │
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
│  │  • create_profile    • update_profile    • follow_user   │    │
│  │  • create_post       • like_post         • unfollow_user │    │
│  │  • create_comment    • react_to_post                     │    │
│  │  • create_chat       • send_message                      │    │
│  │  • create_conversation • send_conversation_message       │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │

└──────────────────────────────────────────────────────────────────┘
```

---

## On-Chain Data

Everything on Shyft is stored as Solana program accounts (PDAs). Nothing is stored in a database.

| Account Type | Rent Each | Description |
|-------------|-----------|-------------|
| **Profile** | ~0.003 SOL | Username, display name, bio, avatar URL, banner URL, follower/following/post counts, created_at |
| **Post** | ~0.0027 SOL | Text content, like counter, comment count, author, timestamp |
| **Comment** | ~0.0022 SOL | Comment text, author, linked post, timestamp |
| **Reaction** | ~0.0014 SOL | Emoji reaction type (❤️🔥🚀😂👏💡), user, linked post |
| **Follow** | ~0.0014 SOL | Follower → following relationship |
| **Chat** | ~0.0013 SOL | Chat metadata between two participants (message counter) |
| **Message** | ~0.005 SOL | E2E encrypted message content (ciphertext), sender, chat reference |

Every interaction is a signed Solana transaction. All rent costs are paid by the platform treasury — **users pay nothing**.

---

## Zero-Cost Onboarding (Treasury Sponsorship)

Shyft is **completely free to use**. The platform treasury pays all Solana transaction fees and account rent. Users never need to own, buy, or transfer any SOL.

### How It Works

| Step | What Happens | Who Pays |
|------|-------------|----------|
| 1. **Sign in** | Privy creates an embedded Solana wallet (0 SOL) | Free |
| 2. **Create profile** | User signs to prove identity → `/api/sponsor-tx` adds treasury as fee payer + rent payer | **Treasury** |
| 3. **All actions** | User's Privy wallet signs silently → treasury co-signs as fee payer via `/api/sponsor-tx` | **Treasury** |

**The user's Privy wallet never needs any SOL.** The on-chain program has a separate `payer` signer on every instruction, so the treasury can pay rent while the user only signs to prove identity. Privy embedded wallets sign silently — no wallet popups.

### Backend API Routes for Sponsorship

| Endpoint | Method | Purpose |
|----------|--------|--------|
| `/api/sponsor-tx` | `GET` | Returns the treasury public key |
| `/api/sponsor-tx` | `POST` | Accepts a partially-signed tx, adds treasury signature as fee payer, submits to Solana |

### Cost Per User

| Action | Cost (SOL) | Frequency |
|--------|-----------|----------|
| Profile creation (rent) | ~0.003 | Once |
| Post (rent) | ~0.0027 | Per post |
| Comment (rent) | ~0.0022 | Per comment |
| Reaction (rent) | ~0.0014 | Per reaction |
| **Total per new user (first post)** | **~0.006** | — |

At current SOL prices (~$180), that's about **$0.001 per user**.

---

## Real-Time Notifications

---

## E2E Encrypted Chat

Shyft has **fully on-chain, end-to-end encrypted P2P messaging**. Messages are stored as ciphertext on Solana — only the sender and receiver can decrypt them.

### Encryption Protocol

| Layer | Technology |
|-------|-----------|
| **Key Exchange** | X25519 (Curve25519 Diffie-Hellman) |
| **Encryption** | XSalsa20-Poly1305 (NaCl Box) |
| **Key Derivation** | Wallet signs `"shyft-encryption-key-v1:{address}"` → SHA-256 → X25519 keypair |
| **Library** | `tweetnacl` (browser-compatible) |

### Message Format

Messages stored on-chain use prefixes to indicate their type:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `PUBKEY:{base64}` | Key exchange — publishes encryption public key | Sent automatically when opening a chat |
| `PLAIN:{text}` | Unencrypted message (before both parties have exchanged keys) | First message in a new chat |
| `ENC:{nonce}:{ciphertext}` | Encrypted message (after key exchange) | All messages after both keys are shared |

### Chat Flow

1. **User A opens chat with User B** → auto-publishes `PUBKEY:` message with their X25519 public key
2. **User A sends first message** → sent as `PLAIN:` (because User B hasn't shared their key yet)
3. **User B opens the chat** → auto-publishes their `PUBKEY:` message
4. **Both keys now on-chain** → all subsequent messages encrypted as `ENC:` using NaCl Box shared secret
5. **Decryption** — each client scans message PDAs, finds peer's public key, computes shared secret, decrypts locally

### Security Properties

- **Forward secrecy per-chat**: Each chat derives a unique shared secret from both parties' X25519 keys
- **On-chain ciphertext**: Only encrypted bytes are stored on Solana — validators, explorers, and third parties see only gibberish
- **No server-side keys**: The server never sees plaintext or private encryption keys
- **Key derivation from wallet**: Encryption keys are deterministically derived from the user's wallet signature — no extra key management

---

## Real-Time Notifications

The notification system polls on-chain data every **5 seconds** and diffs against previously seen keys to detect new activity:

| Notification | Trigger | Example |
|-------------|---------|---------|
| ❤️ **Like** | Someone likes your post | "alice liked your post" |
| 💬 **Comment** | Someone comments on your post | "@alice commented: 'great post!'" |
| 🔥 **Reaction** | Someone reacts to your post | "@alice reacted 🔥 to your post" |
| 🔁 **Repost** | Someone reposts your content | "@alice reposted your post" |
| 👤 **Follow** | Someone follows you | "@alice started following you" |

### How It Works

1. **First poll** on page load seeds all existing on-chain keys as "seen" — no duplicate notifications on refresh
2. **Subsequent polls** every 5 seconds diff new keys against the seen set
3. **clearRpcCache()** is called before every poll to avoid stale Helius RPC data
4. **Seen keys** capped at 2,000 to prevent unbounded localStorage growth
5. **Self-interaction filtering** — you never get notifications for your own activity
6. **Username resolution** — uses on-chain profileMap as fallback when `currentUser` is null (fixes repost attribution)
7. **Sorted by timestamp** — newest notifications appear first in the bell dropdown

---

## Clickable Profiles & Hover Cards

Like X/Twitter, every username and avatar in the feed is interactive:

### Clickable Profiles
- **Post author** (avatar + display name + @username) → Click to view their profile
- **Comment author** (avatar + name) → Click to view their profile
- **Repost original author** ("Reposted from @username") → Click to navigate
- **Cursor** changes to pointer on hover for all clickable profile elements
- **Profile viewing** — when viewing another user's profile: back button, follow/unfollow, explorer link. Wallet management and edit sections are hidden.

### Profile Hover Cards (X-style)
Hover over any username or avatar in the feed to see a popup card:

| Field | Source |
|-------|--------|
| **Avatar** | On-chain `avatarUrl` |
| **Display name** | On-chain `displayName` |
| **@username** | On-chain `username` |
| **Verified badge** | Blue (default) or gold (for OG accounts like @shaan) |
| **Bio** | On-chain `bio` (up to 3 lines) |
| **Following count** | On-chain `followingCount` |
| **Followers count** | On-chain `followerCount` |
| **Post count** | On-chain `postCount` |

The card appears after a **400ms hover delay** and stays open when you move your mouse into it (300ms hide delay). Clicking the avatar or name navigates to the full profile.

### Navigation
- `navigateToProfile(walletAddress)` in Zustand store — sets `viewingProfile` and switches to the Profile tab
- Sidebar and MobileNav "Profile" button always clears `viewingProfile` to show your own profile
- Back button on other users' profiles returns to the feed

---

## Dark / Light Theme

Shyft supports a full **Night Mode** (dark) and **Day Mode** (light) theme with smooth transitions:

### Toggle Locations
| Location | Control |
|----------|---------|
| **Header** | Moon 🌙 / Sun ☀️ icon button (next to notification bell) |
| **Sidebar** (desktop) | "Night Mode" / "Day Mode" button with label |
| **Landing page** | Toggle in the top nav bar (works before sign-in) |

### Implementation

| Layer | How |
|-------|-----|
| **State** | `theme: "light" \| "dark"` in Zustand store, persisted to localStorage |
| **Sync** | `ThemeProvider` component applies `data-theme` attribute to `<html>` |
| **CSS** | `[data-theme="dark"]` selector overrides all hardcoded colors via CSS specificity |
| **Transition** | 200ms ease transition on `background-color`, `border-color`, `color` |
| **Browser chrome** | `<meta name="theme-color">` updates dynamically |

### Dark Theme Covers

- All backgrounds (page `#0F1117`, cards `#1A1D28`, surfaces `#151822`)
- All text colors (primary `#E8ECF4`, muted `#8B92A5`, subtle `#6B7280`)
- All borders and dividers (`#2A2D3A`, `#22252F`)
- Tinted surfaces (notification badges, reaction pills)
- Input fields, textareas, and placeholders
- Scrollbars
- Shadows (darker in dark mode)
- Gradients
- Hover states
- Backdrop blur (mobile nav, landing nav)
- Profile hover cards and notification panels
- Wallet adapter modals

Animation elements (`animate-pulse`, `animate-spin`, `animate-fade-in`, etc.) are excluded from the transition to prevent visual jank.

---

## On-Chain Program (Rust/Anchor)

**Location:** `programs/shadowspace/src/lib.rs` (~1092 lines)

### Account Types (PDAs)

| Account | Seeds | Description |
|---------|-------|-------------|
| **Profile** | `["profile", owner]` | Username, display name, bio, avatar, banner, privacy flag, post/follower/following counts, created_at |
| **Post** | `["post", author, post_id]` | Content, likes counter, comment count, privacy flag, timestamp |
| **Comment** | `["comment", post, author, comment_index]` | Comment text, author, linked post, timestamp |
| **Reaction** | `["reaction", post, user]` | Reaction type (0-5), user, linked post |
| **FollowAccount** | `["follow", follower, following]` | Follower → following relationship, increments profile counters |
| **Chat** | `["chat", chatId]` | Chat metadata between two users (message counter, participants) |
| **Message** | `["message", chatId, index]` | E2E encrypted message content (PLAIN:/ENC:/PUBKEY: prefixed ciphertext) |

### Instructions

| Instruction | Description |
|-------------|-------------|
| `create_profile` | Initialize profile PDA (username, display name, bio). Treasury pays rent |
| `update_profile` | Update display name, bio, avatar URL, banner URL |
| `create_post` | Create post, increment author's post count |
| `create_comment` | Comment on a post |
| `like_post` | Increment post's like counter |
| `react_to_post` | Create reaction PDA (one per user per post) |
| `follow_user` | Create follow account, increment follower/following counters |
| `unfollow_user` | Close follow account, decrement counters |
| `create_chat` | Create chat PDA between two users |
| `send_message` | Send E2E encrypted message (ciphertext stored on-chain) |
| `admin_force_close` | Admin-only: close any program account, reclaim rent |

All instructions have a separate `payer: Signer` field — the treasury pays rent while the user only signs to prove identity.

---

## Backend API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sponsor-tx` | `GET` | Returns treasury public key (fee payer address) |
| `/api/sponsor-tx` | `POST` | Co-signs a transaction as fee payer. Frontend builds tx → user signs → backend adds treasury signature → submits to Solana |
| `/api/upload` | `POST` | Image upload via ImgBB |

---

## Frontend (Next.js)

### Core Components

| Component | File | Description |
|-----------|------|-------------|
| **Feed** | `Feed.tsx` | Post feed with comments, likes, reactions, reposts, share. Rich content rendering. Treasury-sponsored transactions. Auto-refresh every 8s. |
| **Profile** | `Profile.tsx` | Profile page with posts tab, wallet management (balance, QR, export, fund), gold badges, interactive post cards. Supports viewing other users' profiles with follow/unfollow. |
| **ProfileHoverCard** | `ProfileHoverCard.tsx` | X-style hover popup card with avatar, name, username, bio, follower/following/post counts. 400ms show delay, 300ms hide delay. |
| **ThemeProvider** | `ThemeProvider.tsx` | Syncs Zustand `theme` state to `data-theme` attribute on `<html>` and updates `<meta theme-color>`. |
| **Chat** | `Chat.tsx` | E2E encrypted 1:1 messaging with NaCl Box. Key exchange via on-chain PUBKEY messages, PLAIN prefix for pre-key-exchange, ENC prefix for encrypted |
| **Header** | `Header.tsx` | App header with theme toggle (Moon/Sun), notification bell (unread badge, dropdown panel), wallet button |
| **Friends** | `Friends.tsx` | Follow/unfollow users, discover people |
| **Payments** | `Payments.tsx` | SOL payment UI |
| **ProfileSetup** | `ProfileSetup.tsx` | First-time onboarding |
| **Landing** | `Landing.tsx` | Pre-connect landing page with theme toggle |
| **Sidebar** | `Sidebar.tsx` | Desktop navigation with "Night Mode" / "Day Mode" toggle |
| **MobileNav** | `MobileNav.tsx` | Mobile bottom navigation |
| **RichContent** | `RichContent.tsx` | URL/image/video/YouTube auto-detection and rendering |
| **Toast** | `Toast.tsx` | Toast notification system |
| **CreatorDashboard** | `CreatorDashboard.tsx` | Analytics dashboard |
| **OnboardingDemo** | `OnboardingDemo.tsx` | Walkthrough for new users |

### Key Libraries

| File | Purpose |
|------|---------|
| `src/lib/program.ts` | **ShyftClient** — All Solana interactions, caching, treasury sponsorship, E2E encryption, follow/unfollow, profile fetching |
| `src/lib/store.ts` | Zustand store — theme, notifications, liked posts, seen keys, viewingProfile, navigateToProfile, UI state |
| `src/lib/encryption.ts` | NaCl Box E2E encryption — key derivation, encrypt, decrypt, PUBKEY/ENC/PLAIN message handling |
| `src/hooks/useNotifications.ts` | On-chain polling every 5s for likes, comments, reactions, reposts, follows |
| `src/hooks/useProgram.ts` | React hook for ShyftClient |
| `src/hooks/usePrivatePayment.ts` | SOL transfer hook |
| `src/contexts/WalletProvider.tsx` | Privy + Solana wallet setup |
| `src/lib/idl.json` | Anchor IDL for the program |

---

## Project Structure

```
shadowspace/
├── programs/shadowspace/
│   ├── Cargo.toml                 # Rust deps (anchor)
│   └── src/lib.rs                 # Solana program (~1092 lines)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with Privy + WalletProvider + ThemeProvider
│   │   ├── page.tsx               # Main page with tab routing
│   │   ├── globals.css            # TailwindCSS styles + dark/light theme system
│   │   └── api/
│   │       ├── sponsor-tx/route.ts # Treasury co-signs txs as fee payer (zero-cost UX)
│   │       └── upload/route.ts       # Image upload API (ImgBB)
│   ├── components/
│   │   ├── Feed.tsx               # Post feed with full interactions + ProfileHoverCards
│   │   ├── Chat.tsx               # E2E encrypted 1:1 messaging (NaCl Box)
│   │   ├── Payments.tsx           # SOL payments
│   │   ├── Profile.tsx            # Profile + wallet management + view other users
│   │   ├── ProfileSetup.tsx       # First-time onboarding (treasury-sponsored)
│   │   ├── ProfileHoverCard.tsx   # X-style hover popup card
│   │   ├── ThemeProvider.tsx      # Dark/light theme sync
│   │   ├── Friends.tsx            # Follow/discover
│   │   ├── Landing.tsx            # Pre-connect landing + theme toggle
│   │   ├── Header.tsx             # Header + theme toggle + notification bell
│   │   ├── Sidebar.tsx            # Desktop nav + night/day mode toggle
│   │   ├── MobileNav.tsx          # Mobile nav (clears viewingProfile)
│   │   ├── RichContent.tsx        # URL/image/video/YouTube detection
│   │   ├── Toast.tsx              # Toast notifications
│   │   ├── CreatorDashboard.tsx   # Analytics dashboard
│   │   └── OnboardingDemo.tsx     # Walkthrough
│   ├── contexts/
│   │   └── WalletProvider.tsx     # Privy embedded wallet setup
│   ├── hooks/
│   │   ├── useProgram.ts          # ShyftClient hook
│   │   ├── useNotifications.ts    # On-chain notification polling (5s, clearRpcCache)
│   │   ├── usePrivyWallet.ts      # Privy wallet hook (export private key)
│   │   └── usePrivatePayment.ts   # SOL payment hook
│   ├── lib/
│   │   ├── program.ts             # ShyftClient — all Solana RPC interactions + treasury sponsorship
│   │   ├── encryption.ts          # NaCl Box E2E encryption (X25519-XSalsa20-Poly1305)
│   │   ├── store.ts               # Zustand state (theme, notifications, viewingProfile, etc.)
│   │   └── idl.json               # Anchor IDL
│   └── types/
│       ├── index.ts               # TypeScript interfaces
│       └── shadowspace.ts         # Generated program types
├── target/
│   ├── deploy/shadowspace-keypair.json
│   ├── idl/shadowspace.json       # Generated IDL
│   └── types/shadowspace.ts       # Generated types
├── Anchor.toml                    # Anchor config (devnet)
├── Cargo.toml                     # Workspace Cargo config
├── package.json                   # Node.js dependencies
├── next.config.ts                 # Next.js configuration
└── tsconfig.json                  # TypeScript configuration
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Rust** + **Anchor CLI** 0.32.1
- **Solana CLI** with devnet configured

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

### 4. Sign In & Use

1. Click **Sign In** — Privy creates an embedded Solana wallet (email, Google, etc.) — **no SOL needed**
2. **Create your profile** (username, display name, bio) — treasury pays the rent
3. **Post** — type something and hit post (stored on Solana!) — treasury-sponsored, zero cost
4. **Interact** — like, comment, react, repost other posts — all gasless via treasury sponsorship
5. **Click any username** to view their profile — hover for a preview card
6. **Follow** people and chat with them — E2E encrypted messages
7. **Toggle Night Mode** 🌙 from the header, sidebar, or landing page
8. **Check notifications** — bell icon shows real-time activity (polls every 5s)

---

## Deployment

### Frontend (Vercel)

```bash
npx vercel --prod
```

Live at [https://www.shyft.lol](https://www.shyft.lol).

#### Required Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `TREASURY_PRIVATE_KEY` | JSON byte array of the platform treasury keypair (e.g. `[243,52,191,...]`). Used by `/api/sponsor-tx` to co-sign transactions |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC URL (defaults to devnet if not set) |

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
| **E2E Encryption** | NaCl Box (X25519-XSalsa20-Poly1305) via `tweetnacl` |
| **Frontend** | Next.js 16.1.7 (React 19, Turbopack) |
| **Auth** | Privy `@privy-io/react-auth` ^3.18.0 (embedded Solana wallets) |
| **Styling** | Tailwind CSS 4.2 |
| **State** | Zustand 5.0 (persisted — theme, notifications, liked posts, seen keys) |
| **Icons** | Lucide React |
| **Images** | ImgBB API |
| **Deployment** | Vercel |
| **RPC** | Helius Devnet |
| **Treasury** | Platform treasury wallet sponsors all gas + rent (~$0.002 per user) |

---

## How It Works

1. **Everything is on-chain.** Posts, comments, likes, reactions, follows, reposts, profiles, and E2E encrypted chat messages are all Solana program accounts. Each interaction is a signed transaction.

2. **Zero-cost for users.** The platform treasury pays all transaction fees and account rent. Users never need SOL. Profile creation and all interactions are sponsored by the treasury via `/api/sponsor-tx`.

3. **Privy embedded wallets sign silently.** After connecting via email or social login, Privy creates an embedded Solana wallet. All subsequent transactions are signed silently by Privy — no wallet popups, no browser extensions, no SOL needed.

4. **Privy makes onboarding easy.** Users sign in with email, Google, or any social provider. Privy creates an embedded Solana wallet — no browser extension needed, no SOL needed. Users can export their private key or view their wallet on Solana Explorer.

5. **E2E encrypted chat.** Messages between users are encrypted with NaCl Box (X25519-XSalsa20-Poly1305). Keys are derived from wallet signatures and exchanged on-chain. Only the sender and receiver can decrypt — the server, validators, and explorers see only ciphertext.

6. **Real-time notifications via on-chain polling.** Every 5 seconds, the app fetches all comments, reactions, follows, and posts from the chain, diffs against what it's seen before, and surfaces new activity as notifications. Self-interactions are filtered out.

7. **On-chain verifiable data.** Every post, comment, like, reaction, follow, and message is a Solana transaction. Anyone can verify the data on-chain via Solana Explorer — full transparency and ownership.

8. **Reposts are on-chain posts.** When you repost someone's content, a new post is created on-chain with the format `RT|@original_author|content`. The feed detects this prefix and renders it as a styled quote card.

9. **Clickable profiles like X/Twitter.** Every username and avatar in the feed is clickable — navigates to that user's full profile with their posts, follower/following counts, and a follow/unfollow button. Hovering shows an X-style popup card.

10. **Dark/light theme.** Users can toggle between Night Mode and Day Mode from the header, sidebar, or landing page. The theme is persisted across sessions via localStorage.

11. **Admin tools.** `admin_force_close` instruction lets the upgrade authority close any program account and reclaim rent — used for devnet cleanup and account management.

12. **Live feed.** The feed auto-refreshes every 8 seconds — fetching new posts, updated like counts, comments, and reactions from the chain with cache busting to ensure freshness.

---

## Coming Soon

### 🚀 On-Chain Promoted Posts (Ad System)

A fully on-chain, transparent advertising system — like X's promoted tweets, but decentralized on Solana.

- **Anyone can promote their post** by paying SOL — the more you pay, the higher and longer it appears in everyone's feed
- **All ad spend goes to the platform treasury wallet** — fully verifiable on-chain
- **Non-followers see promoted posts too** — promoters pay to reach new audiences, just like X ads
- **Transparent pricing** — promotion cost and duration are stored on-chain, visible to everyone
- **No middleman approval** — permissionless, can't be censored or de-boosted arbitrarily
- **Tiered duration** — e.g. 0.01 SOL = 6 hours, 0.05 SOL = 24 hours, 0.1 SOL = 3 days at top of feed
- **"Promoted" badge** — clearly labeled in the feed so users know it's a paid placement
- **Feed algorithm** — promoted posts sorted by SOL spent, inserted at top / every Nth position

This is the primary revenue model for the platform.

---

## License

ISC
