"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ArrowLeft, DollarSign, Lock, Shield, Search, RefreshCw, Plus, MessageCircle } from "lucide-react";
import { useProgram } from "@/hooks/useProgram";
import { usePrivatePayment } from "@/hooks/usePrivatePayment";
import { toast } from "@/components/Toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { deriveChatId } from "@/lib/program";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface FriendInfo {
  pubkey: PublicKey;
  address: string;
  displayName: string;
  username: string;
  avatar: string;
  isMutual: boolean;
}

interface ChatInfo {
  chatId: number;
  friendAddress: string;
  friend: FriendInfo;
  messageCount: number;
  lastMessage: string;
  lastMessageTime: number;
  isDelegated: boolean;
  isOnChain: boolean; // whether a chat account exists on-chain
}

interface MessageInfo {
  publicKey: string;
  sender: string;
  content: string;
  timestamp: number;
  isPayment: boolean;
  paymentAmount: number;
  isDelegated: boolean;
  messageIndex: number;
}

export default function Chat() {
  const program = useProgram();
  const { publicKey, connected } = useWallet();
  const { sendPayment } = usePrivatePayment();

  // State
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [activeChat, setActiveChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [messageText, setMessageText] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load friends list and existing chats
  const loadFriendsAndChats = useCallback(async () => {
    if (!program || !publicKey) return;
    setLoading(true);
    try {
      // 1. Get user's friend list
      const friendList = await program.getFriendList(publicKey);
      const friendPubkeys: PublicKey[] = friendList?.friends || [];
      console.log("💬 Friends:", friendPubkeys.length);

      // 2. Get all profiles for display names
      const profiles = await program.getAllProfiles();
      const profileMap: Record<string, any> = {};
      profiles.forEach((p: any) => { profileMap[p.owner] = p; });

      // 3. Check mutual friendship for each friend
      const friendInfos: FriendInfo[] = [];
      for (const fPubkey of friendPubkeys) {
        const fAddr = fPubkey.toBase58();
        const profile = profileMap[fAddr];

        let isMutual = false;
        try {
          const theirFriends = await program.getFriendList(fPubkey);
          isMutual = (theirFriends?.friends || []).some((f: PublicKey) => f.equals(publicKey));
        } catch {
          // no friend list
        }

        friendInfos.push({
          pubkey: fPubkey,
          address: fAddr,
          displayName: profile?.displayName || profile?.display_name || fAddr.slice(0, 4) + "..." + fAddr.slice(-4),
          username: profile?.username || fAddr.slice(0, 8),
          avatar: isMutual ? "👥" : "👤",
          isMutual,
        });
      }
      setFriends(friendInfos);

      // 4. Get all existing chats
      const existingChats = await program.getAllChatsForUser(friendPubkeys);
      console.log("💬 Existing chats:", existingChats.length);

      // 5. Get messages for each chat to find last message
      const chatInfos: ChatInfo[] = [];
      for (const chat of existingChats) {
        const friendAddr = chat.user1 === publicKey.toBase58() ? chat.user2 : chat.user1;
        const friend = friendInfos.find(f => f.address === friendAddr);

        // If friend is not in our list, create a basic info
        const friendInfo: FriendInfo = friend || {
          pubkey: new PublicKey(friendAddr),
          address: friendAddr,
          displayName: friendAddr.slice(0, 4) + "..." + friendAddr.slice(-4),
          username: friendAddr.slice(0, 8),
          avatar: "👤",
          isMutual: false,
        };

        // Try to get last message
        let lastMessage = "Start chatting...";
        let lastMessageTime = Number(chat.createdAt) * 1000;
        if (chat.messageCount > 0) {
          try {
            const msgs = await program.getMessagesForChat(Number(chat.chatId));
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1];
              lastMessage = last.isPayment ? `💰 ${last.paymentAmount / 1_000_000} SOL` : last.content;
              lastMessageTime = Number(last.timestamp) * 1000;
            }
          } catch {
            // fallback
          }
        }

        chatInfos.push({
          chatId: Number(chat.chatId),
          friendAddress: friendAddr,
          friend: friendInfo,
          messageCount: chat.messageCount,
          lastMessage: lastMessage.slice(0, 40),
          lastMessageTime,
          isDelegated: chat.isDelegated,
          isOnChain: true,
        });
      }

      // 6. Deduplicate chats by friendAddress (keep the one with most messages / most recent)
      const deduped = new Map<string, ChatInfo>();
      for (const chat of chatInfos) {
        const existing = deduped.get(chat.friendAddress);
        if (!existing) {
          deduped.set(chat.friendAddress, chat);
        } else {
          // Keep the chat with more messages, or if same count, more recent
          if (chat.messageCount > existing.messageCount ||
              (chat.messageCount === existing.messageCount && chat.lastMessageTime > existing.lastMessageTime)) {
            deduped.set(chat.friendAddress, chat);
          }
        }
      }
      const dedupedChats = Array.from(deduped.values());

      // 7. Also add friends that don't have a chat yet (so user can start one)
      for (const friend of friendInfos) {
        if (!dedupedChats.find(c => c.friendAddress === friend.address)) {
          const chatId = deriveChatId(publicKey, friend.pubkey);
          dedupedChats.push({
            chatId,
            friendAddress: friend.address,
            friend,
            messageCount: 0,
            lastMessage: "No messages yet — tap to start",
            lastMessageTime: 0,
            isDelegated: false,
            isOnChain: false,
          });
        }
      }

      // Sort: chats with messages first, then by last message time
      dedupedChats.sort((a, b) => {
        if (a.isOnChain && !b.isOnChain) return -1;
        if (!a.isOnChain && b.isOnChain) return 1;
        return b.lastMessageTime - a.lastMessageTime;
      });

      setChats(dedupedChats);
    } catch (err) {
      console.error("Failed to load chats:", err);
    }
    setLoading(false);
  }, [program, publicKey]);

  useEffect(() => {
    loadFriendsAndChats();
  }, [loadFriendsAndChats]);

  // Load messages when a chat is selected
  const loadMessages = useCallback(async (chatInfo: ChatInfo) => {
    if (!program) return;
    setLoadingMessages(true);
    try {
      const msgs = await program.getMessagesForChat(chatInfo.chatId);
      setMessages(msgs);
      console.log(`💬 Loaded ${msgs.length} messages for chat ${chatInfo.chatId}`);
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([]);
    }
    setLoadingMessages(false);
  }, [program]);

  const selectChat = (chat: ChatInfo) => {
    setActiveChat(chat);
    setMessages([]);
    if (chat.isOnChain) {
      loadMessages(chat);
    }
  };

  // Poll for new messages every 5 seconds when a chat is open
  useEffect(() => {
    if (!activeChat || !program || !activeChat.isOnChain) return;

    const pollInterval = setInterval(() => {
      loadMessages(activeChat);
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [activeChat, program, loadMessages]);

  // Create chat on-chain with MagicBlock (if it doesn't exist) and send message
  const handleSend = async () => {
    if (!messageText.trim() || !activeChat || !program || !publicKey) return;
    const content = messageText;
    setMessageText("");
    setSending(true);

    try {
      let chatId = activeChat.chatId;

      // If chat doesn't exist on-chain yet, create it with MagicBlock permission
      if (!activeChat.isOnChain) {
        setCreatingChat(true);
        toast("privacy", "Creating MagicBlock encrypted chat", "Setting up TEE permissions + delegation...");

        try {
          // Step 1: Create chat + MagicBlock permission (but NOT delegate yet — we need to send message first)
          const createSig = await program.createChat(chatId, activeChat.friend.pubkey);
          console.log("✅ Chat created:", createSig);

          // Step 2: Create MagicBlock permission on the chat PDA
          let hasPermission = false;
          try {
            const chatPda = (await import("@/lib/program")).getChatPda(chatId)[0];
            const { BN } = await import("@coral-xyz/anchor");
            const members = [
              { flags: 7, pubkey: publicKey },
              { flags: 7, pubkey: activeChat.friend.pubkey },
            ];
            const accountType = { chat: { chatId: new BN(chatId) } };
            await program.createPermission(accountType, chatPda, members);
            console.log("✅ MagicBlock permission created on chat");
            hasPermission = true;
          } catch (permErr: any) {
            console.warn("⚠️ Permission failed:", permErr?.message?.slice(0, 100));
          }

          toast("success", hasPermission ? "MagicBlock chat created! 🔐" : "Chat created on-chain", `TX: ${createSig.slice(0, 8)}...`);

          setActiveChat(prev => prev ? { ...prev, isOnChain: true } : null);
          setChats(prev => prev.map(c =>
            c.chatId === chatId ? { ...c, isOnChain: true } : c
          ));
        } catch (err: any) {
          console.error("Chat creation error:", err);
          if (!err?.message?.includes("already in use")) {
            toast("error", "Failed to create chat", err?.message?.slice(0, 80));
            setSending(false);
            setCreatingChat(false);
            return;
          }
          setActiveChat(prev => prev ? { ...prev, isOnChain: true } : null);
          setChats(prev => prev.map(c => c.chatId === chatId ? { ...c, isOnChain: true } : c));
        }
        setCreatingChat(false);
      }

      // Get current message count for the index
      const currentMsgCount = messages.length;

      // Optimistic local update
      const localMsg: MessageInfo = {
        publicKey: `local-${Date.now()}`,
        sender: publicKey.toBase58(),
        content,
        timestamp: Math.floor(Date.now() / 1000).toString() as any,
        isPayment: false,
        paymentAmount: 0,
        isDelegated: false,
        messageIndex: currentMsgCount,
      };
      setMessages(prev => [...prev, localMsg]);

      // Send message on-chain (this also creates MagicBlock permission + delegates the message PDA to TEE)
      try {
        const sig = await program.sendMessage(chatId, currentMsgCount, content);
        console.log("✅ Message sent + delegated to MagicBlock TEE:", sig);
      } catch (sendErr: any) {
        // If chat is delegated from a previous session, create a fresh chat
        if (sendErr?.message?.includes("delegated") || sendErr?.message?.includes("OwnedByWrongProgram")) {
          console.warn("⚠️ Chat PDA is delegated, creating fresh chat...");
          const freshChatId = Date.now() % 2147483647;
          try {
            await program.createChat(freshChatId, activeChat.friend.pubkey);
            chatId = freshChatId;
            setActiveChat(prev => prev ? { ...prev, chatId: freshChatId, isOnChain: true } : null);
            setChats(prev => prev.map(c =>
              c.friendAddress === activeChat.friendAddress
                ? { ...c, chatId: freshChatId, isOnChain: true }
                : c
            ));
            const retrySig = await program.sendMessage(freshChatId, 0, content);
            console.log("✅ Message sent on fresh chat:", retrySig);
            toast("success", "Chat recreated + message sent via MagicBlock", "Previous chat was in TEE");
          } catch (retryErr: any) {
            throw retryErr;
          }
        } else {
          throw sendErr;
        }
      }

      // Note: We don't delegate the chat PDA itself — it must stay writable for message_count.
      // Individual message PDAs are delegated to TEE by sendMessage() above.
      // The chat still has MagicBlock permission restricting access to the two participants.

      // Update chat list
      setChats(prev => prev.map(c =>
        c.chatId === chatId
          ? { ...c, lastMessage: content.slice(0, 40), lastMessageTime: Date.now(), messageCount: c.messageCount + 1 }
          : c
      ));

      // Reload messages to get the on-chain version with the correct chatId
      const finalChatInfo = { ...activeChat, chatId };
      setTimeout(() => loadMessages(finalChatInfo), 2000);
    } catch (err: any) {
      console.error("Send message error:", err);
      toast("error", "Failed to send message", err?.message?.slice(0, 80));
    }
    setSending(false);
  };

  const handleSendPayment = async () => {
    if (!paymentAmount || !activeChat || !program || !publicKey) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast("error", "Invalid amount", "Enter a valid SOL amount");
      return;
    }
    setPaymentAmount("");
    setShowPayment(false);
    setSending(true);

    toast("privacy", "Sending payment", `Transferring ${amount} SOL to ${activeChat.friend.displayName}`);

    try {
      // Step 1: Send the actual SOL transfer first
      console.log(`💸 Sending ${amount} SOL to ${activeChat.friend.address.slice(0, 8)}...`);
      const result = await sendPayment(activeChat.friend.address, amount);
      if (!result) {
        throw new Error("Payment transaction failed");
      }
      console.log("✅ SOL payment confirmed:", result.transferSig);

      // Step 2: Record payment message on-chain (with MagicBlock TEE delegation)
      const chatId = activeChat.chatId;
      const msgIndex = messages.length;
      const paymentLamports = Math.round(amount * 1_000_000); // store in micro-SOL for display

      // Optimistic local update
      const localMsg: MessageInfo = {
        publicKey: `local-pay-${Date.now()}`,
        sender: publicKey.toBase58(),
        content: `💸 Sent ${amount} SOL`,
        timestamp: Math.floor(Date.now() / 1000).toString() as any,
        isPayment: true,
        paymentAmount: paymentLamports,
        isDelegated: false,
        messageIndex: msgIndex,
      };
      setMessages(prev => [...prev, localMsg]);

      // Record on-chain if chat exists (sendMessage also delegates message PDA to MagicBlock TEE)
      if (activeChat.isOnChain) {
        try {
          const sig = await program.sendMessage(chatId, msgIndex, `💸 Sent ${amount} SOL`, true, paymentLamports);
          console.log("✅ Payment message recorded on-chain + delegated to TEE:", sig);
        } catch (msgErr: any) {
          console.warn("⚠️ Payment message record failed (SOL already sent):", msgErr?.message?.slice(0, 100));
        }
      }

      toast("success", "Payment sent! 💸", `${amount} SOL sent to ${activeChat.friend.displayName} — TX: ${result.transferSig.slice(0, 8)}...`);

      // Update chat list
      setChats(prev => prev.map(c =>
        c.chatId === chatId
          ? { ...c, lastMessage: `💸 Sent ${amount} SOL`, lastMessageTime: Date.now(), messageCount: c.messageCount + 1 }
          : c
      ));

      // Reload messages
      setTimeout(() => loadMessages(activeChat), 2000);
    } catch (err: any) {
      console.error("Payment error:", err);
      toast("error", "Payment failed", err?.message?.slice(0, 80));
    }
    setSending(false);
  };

  const filteredChats = chats.filter(c =>
    c.friend.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.friend.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EFF6FF] to-[#F0FDF4] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-bold text-[#1A1A2E] mb-2">Private Messaging</h3>
          <p className="text-sm text-[#64748B]">Connect your wallet to access encrypted chats</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] sm:h-[calc(100vh-73px)] md:h-[calc(100vh-73px)] max-w-5xl mx-auto bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
      {/* Conversation List */}
      <div
        className={`w-full md:w-80 border-r border-[#E2E8F0] flex flex-col ${
          activeChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm text-[#1A1A2E]">Chats</h2>
            <button
              onClick={loadFriendsAndChats}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {loading && chats.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 text-[#94A3B8] animate-spin" />
            </div>
          )}

          {!loading && filteredChats.length === 0 && (
            <div className="p-6 text-center">
              <MessageCircle className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
              <p className="text-sm text-[#94A3B8] mb-1">No chats yet</p>
              <p className="text-xs text-[#94A3B8]">Add friends in your Profile tab to start chatting</p>
            </div>
          )}

          {filteredChats.map((chat) => (
            <button
              key={chat.chatId}
              onClick={() => selectChat(chat)}
              className={`touch-active w-full flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-[#F8FAFC] active:bg-[#F1F5F9] transition-colors border-b border-[#F1F5F9] ${
                activeChat?.chatId === chat.chatId ? "bg-[#EFF6FF]" : ""
              }`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EBF4FF] to-[#E0F2FE] flex items-center justify-center text-xl">
                  {chat.friend.avatar}
                </div>
                {chat.isDelegated && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#7C3AED] border-2 border-white flex items-center justify-center">
                    <Shield className="w-2 h-2 text-white" />
                  </div>
                )}
                {!chat.isDelegated && chat.isOnChain && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#16A34A] border-2 border-white" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#1A1A2E] truncate">{chat.friend.displayName}</span>
                  <span className="text-[10px] text-[#94A3B8] flex-shrink-0">
                    {chat.lastMessageTime > 0 ? timeAgo(chat.lastMessageTime) : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {chat.isDelegated && <Shield className="w-2.5 h-2.5 text-[#7C3AED] flex-shrink-0" />}
                  {!chat.isDelegated && chat.isOnChain && <Lock className="w-2.5 h-2.5 text-[#16A34A] flex-shrink-0" />}
                  {!chat.isOnChain && <Plus className="w-2.5 h-2.5 text-[#94A3B8] flex-shrink-0" />}
                  <p className="text-xs text-[#64748B] truncate">{chat.lastMessage}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${activeChat ? "flex" : "hidden md:flex"}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#E2E8F0] bg-white">
              <button
                onClick={() => { setActiveChat(null); setMessages([]); }}
                className="md:hidden w-9 h-9 rounded-lg hover:bg-[#F1F5F9] active:bg-[#E2E8F0] flex items-center justify-center flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-[#64748B]" />
              </button>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#EBF4FF] to-[#E0F2FE] flex items-center justify-center text-base sm:text-lg flex-shrink-0">
                {activeChat.friend.avatar}
              </div>
              <div className="flex-1">
                <span className="font-semibold text-sm text-[#1A1A2E]">
                  {activeChat.friend.displayName}
                </span>
                <div className="flex items-center gap-1">
                  {activeChat.isDelegated ? (
                    <>
                      <Shield className="w-2.5 h-2.5 text-[#7C3AED]" />
                      <span className="text-[10px] text-[#7C3AED] font-medium">Encrypted via MagicBlock TEE</span>
                    </>
                  ) : activeChat.isOnChain ? (
                    <>
                      <Lock className="w-2.5 h-2.5 text-[#16A34A]" />
                      <span className="text-[10px] text-[#16A34A] font-medium">On-chain chat</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-2.5 h-2.5 text-[#94A3B8]" />
                      <span className="text-[10px] text-[#94A3B8] font-medium">Send a message to create TEE chat</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => loadMessages(activeChat)}
                disabled={loadingMessages}
                className="w-8 h-8 rounded-lg hover:bg-[#F1F5F9] flex items-center justify-center"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#94A3B8] ${loadingMessages ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setShowPayment(!showPayment)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  showPayment ? "bg-[#16A34A] text-white" : "bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7]"
                }`}
              >
                <DollarSign className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFBFC]">
              <div className="flex justify-center mb-4">
                <span className="text-[10px] text-[#94A3B8] bg-white px-3 py-1 rounded-full border border-[#E2E8F0] flex items-center gap-1">
                  {activeChat.isDelegated ? (
                    <>
                      <Shield className="w-2.5 h-2.5 text-[#7C3AED]" /> Messages encrypted via MagicBlock TEE
                    </>
                  ) : (
                    <>
                      <Lock className="w-2.5 h-2.5" /> Messages stored on Solana
                    </>
                  )}
                </span>
              </div>

              {loadingMessages && messages.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 text-[#94A3B8] animate-spin" />
                </div>
              )}

              {!loadingMessages && messages.length === 0 && activeChat.isOnChain && (
                <div className="text-center py-8">
                  <p className="text-sm text-[#94A3B8]">No messages yet. Say hello! 👋</p>
                </div>
              )}

              {!activeChat.isOnChain && messages.length === 0 && (
                <div className="text-center py-8">
                  <Shield className="w-10 h-10 text-[#7C3AED] mx-auto mb-3" />
                  <p className="text-sm text-[#64748B] mb-1">This chat will be encrypted via MagicBlock TEE</p>
                  <p className="text-xs text-[#94A3B8]">Send your first message to create the chat on-chain</p>
                </div>
              )}

              {messages.map((msg) => {
                const isMe = publicKey && msg.sender === publicKey.toBase58();

                if (msg.isPayment) {
                  return (
                    <div key={msg.publicKey} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[280px] rounded-2xl p-3 sm:p-4 ${
                        isMe
                          ? "bg-gradient-to-br from-[#16A34A] to-[#15803D] text-white"
                          : "bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] text-[#15803D]"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4" />
                          <span className="text-xs font-medium">{isMe ? "You sent" : "Received"}</span>
                        </div>
                        <p className="text-2xl font-bold">{(msg.paymentAmount / 1_000_000).toFixed(3)} SOL</p>
                        <div className="flex items-center gap-1 mt-2">
                          <Shield className="w-3 h-3" />
                          <span className="text-[10px] opacity-80">Private Payment via PER</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.publicKey} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[320px] px-3.5 sm:px-4 py-2.5 rounded-2xl text-sm ${
                        isMe
                          ? "bg-[#2563EB] text-white rounded-br-md"
                          : "bg-white text-[#1A1A2E] border border-[#E2E8F0] rounded-bl-md"
                      }`}
                    >
                      <p>{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${isMe ? "text-blue-200" : "text-[#94A3B8]"}`}>
                        <span className="text-[10px]">
                          {Number(msg.timestamp) > 0 ? timeAgo(Number(msg.timestamp) * 1000) : "now"}
                        </span>
                        {msg.isDelegated && <Shield className="w-2 h-2 text-[#7C3AED]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Payment Bar */}
            {showPayment && (
              <div className="px-4 py-3 bg-[#F0FDF4] border-t border-[#DCFCE7] animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-white rounded-xl border border-[#DCFCE7] px-3 py-2">
                    <DollarSign className="w-4 h-4 text-[#16A34A]" />
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Amount"
                      className="flex-1 text-sm focus:outline-none bg-transparent"
                    />
                    <span className="text-xs font-medium text-[#64748B]">SOL</span>
                  </div>
                  <button
                    onClick={handleSendPayment}
                    disabled={!paymentAmount}
                    className="px-4 py-2.5 bg-[#16A34A] text-white text-sm font-medium rounded-xl hover:bg-[#15803D] disabled:opacity-40 transition-all"
                  >
                    Send
                  </button>
                </div>
                <p className="text-[10px] text-[#16A34A] mt-1.5 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" /> Payment will be processed privately through MagicBlock PER
                </p>
              </div>
            )}

            {/* Message Input */}
            <div className="p-2.5 sm:p-3 border-t border-[#E2E8F0] bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={creatingChat ? "Creating encrypted chat..." : "Type a message..."}
                  disabled={sending || creatingChat}
                  className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 sm:px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending || creatingChat}
                  className="touch-active w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:opacity-40 transition-all flex-shrink-0"
                >
                  {sending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-[#2563EB]" />
              </div>
              <h3 className="font-bold text-[#1A1A2E] mb-1">
                {chats.length > 0 ? "Select a conversation" : "No friends yet"}
              </h3>
              <p className="text-sm text-[#64748B]">
                {chats.length > 0
                  ? "All messages are encrypted via MagicBlock TEE"
                  : "Add friends in your Profile to start chatting"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
