import { Program, AnchorProvider, Idl, BN, BorshCoder } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import idl from "./idl.json";

const PROGRAM_ID = new PublicKey("EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ");
const PERMISSION_PROGRAM_ID = new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");
const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const TEE_VALIDATOR = new PublicKey("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");
const MAGIC_PROGRAM = new PublicKey("Magic11111111111111111111111111111111111111");
const MAGIC_CONTEXT = new PublicKey("MagicContext1111111111111111111111111111111");

const PROFILE_SEED = Buffer.from("profile");
const POST_SEED = Buffer.from("post");
const CHAT_SEED = Buffer.from("chat");
const MESSAGE_SEED = Buffer.from("message");
const FRIEND_SEED = Buffer.from("friends");

// ========== Helpers ==========

/** Convert u64 to little-endian 8 bytes (matches Rust's to_le_bytes()) */
function toLEBytes(num: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  // Write as little-endian u64
  view.setBigUint64(0, BigInt(num), true);
  return new Uint8Array(buffer);
}

/** Browser-safe u64 to big-endian 8 bytes (alternative encoding) */
function toBEBytes(num: number): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  // Write as big-endian u64
  view.setBigUint64(0, BigInt(num), false);
  return new Uint8Array(buffer);
}

// ========== PDA Derivation Helpers ==========

function getProfilePda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([PROFILE_SEED, owner.toBuffer()], PROGRAM_ID);
}

function getPostPda(author: PublicKey, postId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([POST_SEED, author.toBuffer(), toLEBytes(postId)], PROGRAM_ID);
}

function getChatPda(chatId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CHAT_SEED, toLEBytes(chatId)], PROGRAM_ID);
}

function getMessagePda(chatId: number, messageIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([MESSAGE_SEED, toLEBytes(chatId), toLEBytes(messageIndex)], PROGRAM_ID);
}

function getFriendListPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FRIEND_SEED, owner.toBuffer()], PROGRAM_ID);
}

/** Permission PDA — derived by the Permission Program
 *  Seeds: ["permission:", permissioned_account] per MagicBlock SDK v0.8.0 */
function getPermissionPda(permissionedAccount: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("permission:"), permissionedAccount.toBuffer()],
    PERMISSION_PROGRAM_ID
  );
}

/** Delegation buffer PDA — derived by the OWNER program (our program), NOT delegation program */
function getDelegationBufferPda(pda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), pda.toBuffer()],
    PROGRAM_ID
  );
}

/** Delegation record PDA — derived by the Delegation Program */
function getDelegationRecordPda(pda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), pda.toBuffer()],
    DELEGATION_PROGRAM_ID
  );
}

/** Delegation metadata PDA — derived by the Delegation Program */
function getDelegationMetadataPda(pda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), pda.toBuffer()],
    DELEGATION_PROGRAM_ID
  );
}

export class ShyftClient {
  program: Program;
  provider: AnchorProvider;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = new Program(idl as Idl, provider);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get accounts(): any {
    return this.program.account;
  }

  // ========== PROFILE ==========

  async createProfile(username: string, displayName: string, bio: string): Promise<string> {
    const user = this.provider.wallet.publicKey;
    const [profilePda] = getProfilePda(user);

    const sig = await this.program.methods
      .createProfile(username, displayName, bio)
      .accounts({
        profile: profilePda,
        user,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return sig;
  }

  async getProfile(owner: PublicKey): Promise<any> {
    const [profilePda] = getProfilePda(owner);
    try {
      return await this.accounts.profile.fetch(profilePda);
    } catch {
      return null;
    }
  }

  async updateProfilePrivacy(isPrivate: boolean): Promise<string> {
    const user = this.provider.wallet.publicKey;
    const [profilePda] = getProfilePda(user);
    const [permissionPda] = getPermissionPda(profilePda);

    const sig = await this.program.methods
      .updateProfilePrivacy(isPrivate)
      .accounts({
        profile: profilePda,
        user,
        permission: permissionPda,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .rpc();
    return sig;
  }

  // ========== POSTS ==========

  async createPost(postId: number, content: string, isPrivate: boolean): Promise<string> {
    const author = this.provider.wallet.publicKey;
    if (!author) {
      throw new Error("Wallet not connected - no public key available");
    }

    // Debug logging
    console.log("=== Creating Post ===");
    console.log("Author:", author.toBase58());
    console.log("Post ID:", postId);
    
    // Let Anchor derive the PDAs - don't pass them explicitly
    // The program constraints should handle the derivation
    try {
      const sig = await this.program.methods
        .createPost(new BN(postId), content, isPrivate)
        .accounts({
          author,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("Post created successfully:", sig);
      return sig;
    } catch (err: any) {
      console.error("Create post error:", err);
      throw err;
    }
  }

  async getPost(author: PublicKey, postId: number): Promise<any> {
    const [postPda] = getPostPda(author, postId);
    try {
      return await this.accounts.post.fetch(postPda);
    } catch {
      return null;
    }
  }

  async getAllPublicPosts(): Promise<any[]> {
    try {
      const allPosts = await this.accounts.post.all();
      return allPosts
        .map((p: any) => ({
          publicKey: p.publicKey.toBase58(),
          ...p.account,
          author: p.account.author.toBase58(),
          postId: p.account.postId?.toString(),
          likes: p.account.likes?.toString() || "0",
          commentCount: p.account.commentCount?.toString() || "0",
          createdAt: p.account.createdAt?.toString() || "0",
        }))
        .filter((p: any) => !p.isPrivate)
        .sort((a: any, b: any) => Number(b.createdAt) - Number(a.createdAt));
    } catch {
      return [];
    }
  }

  async getPostsByAuthor(author: PublicKey): Promise<any[]> {
    try {
      const allPosts = await this.accounts.post.all();
      const authorStr = author.toBase58();
      return allPosts
        .map((p: any) => ({
          publicKey: p.publicKey.toBase58(),
          ...p.account,
          author: p.account.author.toBase58(),
          postId: p.account.postId?.toString(),
          likes: p.account.likes?.toString() || "0",
          commentCount: p.account.commentCount?.toString() || "0",
          createdAt: p.account.createdAt?.toString() || "0",
        }))
        .filter((p: any) => p.author === authorStr)
        .sort((a: any, b: any) => Number(b.createdAt) - Number(a.createdAt));
    } catch {
      return [];
    }
  }

  /** Fetch ALL posts — both regular (owned by our program) and delegated (owned by delegation program).
   *  Delegated posts are decoded manually since Anchor's post.all() only returns our-program-owned accounts. */
  async getAllPostsIncludingDelegated(): Promise<{ publicKey: string; author: string; postId: string; content: string; isPrivate: boolean; likes: string; commentCount: string; createdAt: string; isDelegated: boolean }[]> {
    const coder = new BorshCoder(idl as Idl);

    // 1. Fetch regular (non-delegated) posts via Anchor (camelCase fields)
    const regularPosts = await this.accounts.post.all();
    const mapped: any[] = regularPosts.map((p: any) => ({
      publicKey: p.publicKey.toBase58(),
      author: p.account.author.toBase58(),
      postId: p.account.postId?.toString() || "0",
      content: p.account.content || "",
      isPrivate: p.account.isPrivate,
      likes: p.account.likes?.toString() || "0",
      commentCount: p.account.commentCount?.toString() || "0",
      createdAt: p.account.createdAt?.toString() || "0",
      isDelegated: false,
    }));

    // 2. Fetch delegated posts (owned by delegation program, same data layout)
    //    Filter by data size (Post accounts are 589 bytes: 8 discriminator + 581 data)
    try {
      const delegatedAccounts = await this.provider.connection.getProgramAccounts(
        DELEGATION_PROGRAM_ID,
        {
          filters: [
            { dataSize: 589 },
          ],
        }
      );

      console.log(`Found ${delegatedAccounts.length} delegated accounts (589 bytes)`);

      for (const acc of delegatedAccounts) {
        try {
          // BorshCoder.accounts.decode uses capitalized name and returns snake_case fields
          const decoded = coder.accounts.decode("Post", acc.account.data);
          mapped.push({
            publicKey: acc.pubkey.toBase58(),
            author: decoded.author.toBase58(),
            postId: decoded.post_id?.toString() || "0",
            content: decoded.content || "",
            isPrivate: decoded.is_private,
            likes: decoded.likes?.toString() || "0",
            commentCount: decoded.comment_count?.toString() || "0",
            createdAt: decoded.created_at?.toString() || "0",
            isDelegated: true,
          });
        } catch {
          // Not a post account — skip (delegation program owns many account types)
        }
      }
    } catch (err) {
      console.error("Failed to fetch delegated posts:", err);
    }

    // Deduplicate by publicKey (in case an account was just undelegated)
    const seen = new Set<string>();
    const unique = mapped.filter((p: any) => {
      if (seen.has(p.publicKey)) return false;
      seen.add(p.publicKey);
      return true;
    });

    return unique;
  }

  async getAllProfiles(): Promise<any[]> {
    try {
      const allProfiles = await this.accounts.profile.all();
      return allProfiles.map((p: any) => ({
        publicKey: p.publicKey.toBase58(),
        ...p.account,
        owner: p.account.owner.toBase58(),
      }));
    } catch {
      return [];
    }
  }

  async likePost(author: PublicKey, postId: number): Promise<string> {
    const [postPda] = getPostPda(author, postId);

    const sig = await this.program.methods
      .likePost(new BN(postId))
      .accounts({
        post: postPda,
        user: this.provider.wallet.publicKey,
      })
      .rpc();
    return sig;
  }

  // ========== CHAT ==========

  async createChat(chatId: number, user2: PublicKey): Promise<string> {
    const user1 = this.provider.wallet.publicKey;
    const [chatPda] = getChatPda(chatId);

    const sig = await this.program.methods
      .createChat(new BN(chatId))
      .accounts({
        chat: chatPda,
        user1,
        user2,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return sig;
  }

  async sendMessage(
    chatId: number,
    messageIndex: number,
    content: string,
    isPayment: boolean = false,
    paymentAmount: number = 0
  ): Promise<string> {
    const sender = this.provider.wallet.publicKey;
    const [messagePda] = getMessagePda(chatId, messageIndex);
    const [chatPda] = getChatPda(chatId);

    // Safety check: if chat PDA was delegated from a previous session, bail out so caller can retry
    const chatAccInfo = await this.provider.connection.getAccountInfo(chatPda);
    if (chatAccInfo && chatAccInfo.owner.equals(DELEGATION_PROGRAM_ID)) {
      console.warn("⚠️  Chat PDA is delegated — caller should create a fresh chat.");
      throw new Error("Chat is delegated to TEE. Create a new chat.");
    }

    // Step 1: Send the message on-chain
    const sig = await this.program.methods
      .sendMessage(new BN(chatId), new BN(messageIndex), content, isPayment, new BN(paymentAmount))
      .accounts({
        message: messagePda,
        chat: chatPda,
        sender,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("✅ Message sent on-chain:", sig);

    // Step 2: Create MagicBlock permission on the message PDA
    // Get the other participant from the chat
    try {
      const chatData = await this.accounts.chat.fetch(chatPda);
      const user1 = chatData.user1 as PublicKey;
      const user2 = chatData.user2 as PublicKey;
      const members = [
        { flags: 7, pubkey: user1 },
        { flags: 7, pubkey: user2 },
      ];
      const accountType = { message: { chatId: new BN(chatId), messageIndex: new BN(messageIndex) } };

      const permSig = await this.createPermission(accountType, messagePda, members);
      console.log("✅ MagicBlock permission created for message:", permSig);

      // Step 3: Delegate the message PDA to TEE
      const delSig = await this.delegateAccount(accountType, messagePda);
      console.log("✅ Message delegated to MagicBlock TEE:", delSig);
    } catch (err: any) {
      // Permission/delegation is best-effort — message is already on-chain
      console.warn("⚠️ MagicBlock delegation for message failed (msg still sent):", err?.message?.slice(0, 100));
    }

    return sig;
  }

  async getChat(chatId: number): Promise<any> {
    const [chatPda] = getChatPda(chatId);
    try {
      return await this.accounts.chat.fetch(chatPda);
    } catch {
      return null;
    }
  }

  async getMessage(chatId: number, messageIndex: number): Promise<any> {
    const [messagePda] = getMessagePda(chatId, messageIndex);
    try {
      return await this.accounts.message.fetch(messagePda);
    } catch {
      return null;
    }
  }

  /** Fetch all chats involving the current user.
   *  Instead of scanning the entire delegation program (100K+ accounts),
   *  we check each friend's expected chat PDA directly. */
  async getAllChatsForUser(friendPubkeys: PublicKey[] = []): Promise<any[]> {
    const coder = new BorshCoder(idl as Idl);
    const user = this.provider.wallet.publicKey;
    const userStr = user.toBase58();

    // 1. Regular chats from our program
    const allChats = await this.accounts.chat.all();
    const mapped: any[] = allChats
      .map((c: any) => ({
        publicKey: c.publicKey.toBase58(),
        chatId: c.account.chatId?.toString() || "0",
        user1: c.account.user1?.toBase58() || "",
        user2: c.account.user2?.toBase58() || "",
        messageCount: Number(c.account.messageCount || 0),
        createdAt: c.account.createdAt?.toString() || "0",
        isDelegated: false,
      }))
      .filter((c: any) => c.user1 === userStr || c.user2 === userStr);

    // 2. For each friend, check if their chat PDA exists as a delegated account
    for (const friend of friendPubkeys) {
      const chatId = deriveChatId(user, friend);
      const [chatPda] = getChatPda(chatId);
      const chatPdaStr = chatPda.toBase58();

      // Skip if already found in regular chats
      if (mapped.find(c => c.publicKey === chatPdaStr)) continue;

      try {
        const accInfo = await this.provider.connection.getAccountInfo(chatPda);
        if (accInfo && accInfo.owner.equals(DELEGATION_PROGRAM_ID)) {
          // This chat was delegated to TEE — decode it
          try {
            const decoded = coder.accounts.decode("Chat", accInfo.data);
            mapped.push({
              publicKey: chatPdaStr,
              chatId: decoded.chat_id?.toString() || chatId.toString(),
              user1: decoded.user1?.toBase58() || userStr,
              user2: decoded.user2?.toBase58() || friend.toBase58(),
              messageCount: Number(decoded.message_count || 0),
              createdAt: decoded.created_at?.toString() || "0",
              isDelegated: true,
            });
          } catch {
            // Decode failed
          }
        }
      } catch {
        // Account doesn't exist
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return mapped.filter((c: any) => {
      if (seen.has(c.publicKey)) return false;
      seen.add(c.publicKey);
      return true;
    });
  }

  /** Fetch all messages for a specific chat (both regular and delegated). */
  async getMessagesForChat(chatId: number): Promise<any[]> {
    const coder = new BorshCoder(idl as Idl);
    const chatIdStr = chatId.toString();

    // 1. Regular messages — fetch all and filter by chatId in JS
    const allMessages = await this.accounts.message.all();
    const mapped: any[] = allMessages
      .map((m: any) => ({
        publicKey: m.publicKey.toBase58(),
        chatId: m.account.chatId?.toString() || "0",
        messageIndex: Number(m.account.messageIndex || 0),
        sender: m.account.sender?.toBase58() || "",
        content: m.account.content || "",
        isPayment: m.account.isPayment || false,
        paymentAmount: Number(m.account.paymentAmount || 0),
        timestamp: m.account.timestamp?.toString() || "0",
        isDelegated: false,
      }))
      .filter((m: any) => m.chatId === chatIdStr);

    // 2. Delegated messages (589 bytes — same as Post! Decode as Message and filter by chatId)
    try {
      const delegatedAccounts = await this.provider.connection.getProgramAccounts(
        DELEGATION_PROGRAM_ID,
        {
          filters: [{ dataSize: 589 }],
        }
      );
      for (const acc of delegatedAccounts) {
        try {
          const decoded = coder.accounts.decode("Message", acc.account.data);
          const msgChatId = decoded.chat_id?.toString() || "0";
          if (msgChatId === chatIdStr) {
            mapped.push({
              publicKey: acc.pubkey.toBase58(),
              chatId: msgChatId,
              messageIndex: Number(decoded.message_index || 0),
              sender: decoded.sender?.toBase58() || "",
              content: decoded.content || "",
              isPayment: decoded.is_payment || false,
              paymentAmount: Number(decoded.payment_amount || 0),
              timestamp: decoded.timestamp?.toString() || "0",
              isDelegated: true,
            });
          }
        } catch {
          // Not a Message account (could be Post)
        }
      }
    } catch (err) {
      console.error("Failed to fetch delegated messages:", err);
    }

    // Deduplicate and sort by message index
    const seen = new Set<string>();
    return mapped
      .filter((m: any) => {
        if (seen.has(m.publicKey)) return false;
        seen.add(m.publicKey);
        return true;
      })
      .sort((a: any, b: any) => a.messageIndex - b.messageIndex);
  }

  /** Create a private chat with MagicBlock TEE delegation */
  async createPrivateChatFull(
    chatId: number,
    user2: PublicKey
  ): Promise<{ createSig: string; permissionSig?: string; delegateSig?: string }> {
    const user1 = this.provider.wallet.publicKey;
    if (!user1) throw new Error("Wallet not connected");

    console.log("🔐 === Creating Private Chat with MagicBlock ===");
    console.log("Chat ID:", chatId, "Between:", user1.toBase58().slice(0, 8), "and", user2.toBase58().slice(0, 8));

    // Step 1: Create chat on-chain
    console.log("📝 Step 1: Creating chat...");
    const createSig = await this.createChat(chatId, user2);
    console.log("✅ Chat created:", createSig);

    // Step 2: Create permission (restrict to the 2 participants)
    let permissionSig: string | undefined;
    const [chatPda] = getChatPda(chatId);
    const members = [
      { flags: 7, pubkey: user1 }, // AUTHORITY + TX_LOGS + TX_BALANCES
      { flags: 7, pubkey: user2 }, // Both have full access
    ];
    const accountType = { chat: { chatId: new BN(chatId) } };

    try {
      console.log("🔒 Step 2: Creating MagicBlock permission...");
      permissionSig = await this.createPermission(accountType, chatPda, members);
      console.log("✅ Permission created:", permissionSig);
    } catch (err: any) {
      console.warn("⚠️  Permission failed:", err?.message?.slice(0, 100));
    }

    // Note: We do NOT delegate the chat PDA itself to TEE.
    // The chat PDA must stay writable on devnet so sendMessage can increment message_count.
    // Instead, individual message PDAs are delegated to TEE after sending (see sendMessage).
    // The permission on the chat PDA still restricts access to the two participants.

    return { createSig, permissionSig, delegateSig: undefined };
  }

  // ========== FRIENDS ==========

  async createFriendList(): Promise<string> {
    const user = this.provider.wallet.publicKey;
    const [friendListPda] = getFriendListPda(user);

    const sig = await this.program.methods
      .createFriendList()
      .accounts({
        friendList: friendListPda,
        user,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return sig;
  }

  async addFriend(friend: PublicKey): Promise<string> {
    const user = this.provider.wallet.publicKey;
    const [friendListPda] = getFriendListPda(user);
    const [profilePda] = getProfilePda(user);

    const sig = await this.program.methods
      .addFriend(friend)
      .accounts({
        friendList: friendListPda,
        profile: profilePda,
        user,
      })
      .rpc();
    return sig;
  }

  async removeFriend(friend: PublicKey): Promise<string> {
    const user = this.provider.wallet.publicKey;
    const [friendListPda] = getFriendListPda(user);
    const [profilePda] = getProfilePda(user);

    const sig = await this.program.methods
      .removeFriend(friend)
      .accounts({
        friendList: friendListPda,
        profile: profilePda,
        user,
      })
      .rpc();
    return sig;
  }

  async getFriendList(owner: PublicKey): Promise<any> {
    const [friendListPda] = getFriendListPda(owner);
    try {
      return await this.accounts.friendList.fetch(friendListPda);
    } catch {
      return null;
    }
  }

  // ========== DELEGATION & PERMISSIONS ==========

  async delegateAccount(accountType: any, pda: PublicKey): Promise<string> {
    const [bufferPda] = getDelegationBufferPda(pda);
    const [delegationRecordPda] = getDelegationRecordPda(pda);
    const [delegationMetadataPda] = getDelegationMetadataPda(pda);

    const sig = await this.program.methods
      .delegatePda(accountType)
      .accounts({
        bufferPda,
        delegationRecordPda,
        delegationMetadataPda,
        pda,
        payer: this.provider.wallet.publicKey,
        ownerProgram: PROGRAM_ID,
        delegationProgram: DELEGATION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: TEE_VALIDATOR, isSigner: false, isWritable: false },
      ])
      .rpc();
    return sig;
  }

  async createPermission(accountType: any, pda: PublicKey, members: any[] | null): Promise<string> {
    // Permission PDA: seeds = ["permission:", permissioned_account] per MagicBlock SDK v0.8.0
    const [permissionPda] = getPermissionPda(pda);

    try {
      const sig = await this.program.methods
        .createPermission(accountType, members)
        .accounts({
          permissionedAccount: pda,
          permission: permissionPda,
          payer: this.provider.wallet.publicKey,
          permissionProgram: PERMISSION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("✅ Permission created:", sig);
      return sig;
    } catch (err: any) {
      console.error("❌ Permission creation failed:", err.message?.slice(0, 200));
      throw err;
    }
  }

  async undelegate(account: PublicKey): Promise<string> {
    const sig = await this.program.methods
      .undelegate()
      .accounts({
        payer: this.provider.wallet.publicKey,
        account,
        magicProgram: MAGIC_PROGRAM,
        magicContext: MAGIC_CONTEXT,
      })
      .rpc();
    return sig;
  }

  async processUndelegation(
    baseAccount: PublicKey,
    buffer: PublicKey,
    accountSeeds: Buffer[]
  ): Promise<string> {
    const sig = await this.program.methods
      .processUndelegation(accountSeeds)
      .accounts({
        baseAccount,
        buffer,
        payer: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return sig;
  }

  // ========== HELPER: Full private post flow ==========

  async createPrivatePost(
    postId: number,
    content: string,
    friendPubkeys: PublicKey[]
  ): Promise<{ createSig: string; permissionSig?: string; delegateSig?: string }> {
    const author = this.provider.wallet.publicKey;
    if (!author) {
      throw new Error("Wallet not connected");
    }

    console.log("🔐 === Creating Private Post with MagicBlock ===");
    
    try {
      // Step 1: Create the post on-chain
      console.log("📝 Step 1: Creating post...");
      const createSig = await this.createPost(postId, content, true);
      console.log("✅ Post created:", createSig);

      // Step 2: Create permission for the post (restrict to friends only)
      console.log("🔒 Step 2: Creating permission for MagicBlock...");
      const [postPda] = getPostPda(author, postId);
      
      // Prepare members: author has full access, friends have read-only
      const members = [
        { flags: 7, pubkey: author }, // AUTHORITY + TX_LOGS + TX_BALANCES (full access)
        ...friendPubkeys.map((f) => ({ flags: 6, pubkey: f })), // TX_LOGS + TX_BALANCES (read-only)
      ];
      
      const accountType = { post: { author, postId: new BN(postId) } };
      
      let permissionSig = undefined;
      try {
        permissionSig = await this.createPermission(accountType, postPda, members);
        console.log("✅ Permission created:", permissionSig);
      } catch (permErr: any) {
        console.warn("⚠️  Permission creation failed, continuing without delegation:", permErr?.message?.slice(0, 100));
        // Continue anyway - post is created, just without MagicBlock encryption
      }

      // Step 3: Delegate to TEE (if permission succeeded)
      let delegateSig = undefined;
      if (permissionSig) {
        console.log("🚀 Step 3: Delegating to MagicBlock TEE...");
        try {
          delegateSig = await this.delegateAccount(accountType, postPda);
          console.log("✅ Delegated to TEE:", delegateSig);
        } catch (delErr: any) {
          console.warn("⚠️  Delegation failed:", delErr?.message?.slice(0, 100));
        }
      }

      return { createSig, permissionSig, delegateSig };
    } catch (err) {
      console.error("❌ Error in private post creation:", err);
      throw err;
    }
  }

  // ========== HELPER: Full private chat flow ==========

  async createPrivateChat(
    chatId: number,
    user2: PublicKey
  ): Promise<{ createSig: string; permissionSig: string; delegateSig: string }> {
    const user1 = this.provider.wallet.publicKey;

    // 1. Create chat
    const createSig = await this.createChat(chatId, user2);

    // 2. Permission — only the 2 participants
    const [chatPda] = getChatPda(chatId);
    const members = [
      { flags: 7, pubkey: user1 },
      { flags: 7, pubkey: user2 },
    ];
    const accountType = { chat: { chatId: new BN(chatId) } };
    const permissionSig = await this.createPermission(accountType, chatPda, members);

    // 3. Delegate to TEE
    const delegateSig = await this.delegateAccount(accountType, chatPda);

    return { createSig, permissionSig, delegateSig };
  }
}

/** Derive a deterministic chat ID from two public keys.
 *  Sorts the keys lexicographically so both users derive the same ID. */
export function deriveChatId(user1: PublicKey, user2: PublicKey): number {
  const sorted = [user1.toBase58(), user2.toBase58()].sort();
  // Hash the sorted pair into a u32-safe number (fits in BN / u64)
  let hash = 0;
  const str = sorted[0] + sorted[1];
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  // Make sure it's positive
  return Math.abs(hash);
}

// Export PDA helpers for use in components
export {
  getProfilePda,
  getPostPda,
  getChatPda,
  getMessagePda,
  getFriendListPda,
  getPermissionPda,
  getDelegationBufferPda,
  getDelegationRecordPda,
  getDelegationMetadataPda,
  toLEBytes,
  PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  DELEGATION_PROGRAM_ID,
  TEE_VALIDATOR,
  MAGIC_PROGRAM,
  MAGIC_CONTEXT,
};
