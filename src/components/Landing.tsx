"use client";

import { useState, useEffect } from "react";
import { Shield, MessageCircle, Wallet, Lock, Users, ArrowRight, Zap, ChevronRight, Sparkles, Sun, Moon, Activity, Smartphone, Globe, Star } from "lucide-react";
import { useWallet } from "@/hooks/usePrivyWallet";
import { useAppStore } from "@/lib/store";

const features = [
  {
    icon: Shield,
    title: "On-Chain Posts",
    description: "Your posts live on Solana — permanent, censorship-resistant, and fully owned by you.",
    color: "#2563EB",
    bgColor: "#EFF6FF",
    preview: {
      type: "post",
      author: "You",
      content: "Just shipped a new feature! Posted permanently on Solana...",
      badge: "On-Chain",
    },
  },
  {
    icon: MessageCircle,
    title: "Encrypted Chat",
    description: "End-to-end encrypted with NaCl Box. Not even the app can read your conversations.",
    color: "#16A34A",
    bgColor: "#F0FDF4",
    preview: {
      type: "chat",
      messages: [
        { sender: "Alice", text: "Hey, check out this alpha..." },
        { sender: "You", text: "This is incredible, sending you 5 USDC" },
        { sender: "system", text: "\u{1F4B8} 5 USDC sent privately" },
      ],
    },
  },
  {
    icon: Wallet,
    title: "Instant Payments",
    description: "Send SOL directly to friends on Solana. Fast, cheap, and recorded on-chain.",
    color: "#2563EB",
    bgColor: "#EFF6FF",
    preview: {
      type: "payment",
      steps: ["Enter recipient & amount", "Sign the transaction", "SOL arrives instantly"],
    },
  },
  {
    icon: Users,
    title: "Follow Network",
    description: "Follow anyone on-chain. Build your social graph stored directly on Solana.",
    color: "#16A34A",
    bgColor: "#F0FDF4",
    preview: {
      type: "follows",
      count: "Your network. Your graph.",
    },
  },
];

export default function Landing() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [showApp, setShowApp] = useState(false);
  const { login, ready } = useWallet();
  const { theme, toggleTheme } = useAppStore();
  const [stats, setStats] = useState<{
    profiles: number; posts: number; follows: number;
    reactions: number; comments: number; transactions: number;
  } | null>(null);

  // Fetch live on-chain stats
  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(data => { if (!data.error) setStats(data); })
      .catch(() => {});
  }, []);

  // Auto-cycle features every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen flex flex-col overflow-x-hidden ${isDark ? "bg-[#000000]" : "bg-[#FAFBFC]"}`}>
      {/* Nav */}
      <nav className={`flex items-center justify-between px-4 sm:px-6 md:px-12 py-3 sm:py-4 border-b backdrop-blur-lg sticky top-0 z-50 ${isDark ? "border-white/10 bg-[#000000]/80" : "border-[#E2E8F0] bg-white/80"}`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <img src="/shyftlogo.png" alt="Shyft" className="shyft-logo w-10 h-10 sm:w-12 sm:h-12" />
          <div>
            <h1 className={`text-base sm:text-lg font-bold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>Shyft</h1>
            <p className={`text-[9px] sm:text-[10px] -mt-0.5 ${isDark ? "text-white/40" : "text-[#64748B]"}`}>On-Chain Social</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="/docs" className={`hidden sm:flex items-center gap-1.5 text-xs transition-colors px-3 py-1.5 rounded-lg ${isDark ? "text-white/50 hover:text-white hover:bg-white/5" : "text-[#64748B] hover:text-[#2563EB] hover:bg-[#F1F5F9]"}`}>
            Docs
          </a>
          <a href="https://explorer.solana.com/address/EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ" target="_blank" rel="noopener noreferrer" className={`hidden sm:flex items-center gap-1.5 text-xs transition-colors px-3 py-1.5 rounded-lg ${isDark ? "text-white/50 hover:text-white hover:bg-white/5" : "text-[#64748B] hover:text-[#2563EB] hover:bg-[#F1F5F9]"}`}>
            On-Chain ↗
          </a>
          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${isDark ? "bg-white/10 hover:bg-white/15" : "bg-[#F1F5F9] hover:bg-[#E2E8F0]"}`}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-[#F59E0B]" /> : <Moon className="w-4 h-4 text-[#64748B]" />}
          </button>
          <button
            onClick={login}
            disabled={!ready}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 shadow-lg ${isDark ? "bg-white hover:bg-white/90 text-[#000000]" : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white"}`}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-20 md:py-28 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-green-600/8 blur-[100px]" />
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-blue-400/8 blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-5xl w-full">
          {/* Badge */}
          <div className={`flex items-center gap-2 px-4 py-1.5 border rounded-full mb-6 backdrop-blur-sm ${isDark ? "bg-white/5 border-white/10" : "bg-white border-[#E2E8F0] shadow-sm"}`}>
            <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span className={`text-[11px] sm:text-xs font-medium ${isDark ? "text-white/60" : "text-[#64748B]"}`}>Live on Solana Mainnet · Zero Gas Fees</span>
          </div>

          {/* Title */}
          <h2 className={`text-4xl sm:text-5xl md:text-7xl font-bold text-center max-w-4xl leading-[1.1] tracking-tight ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>
            Social media,{" "}
            <span className="bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#16A34A] bg-clip-text text-transparent">
              finally on-chain
            </span>
          </h2>
          <p className={`text-base sm:text-lg md:text-xl text-center max-w-xl mt-4 leading-relaxed px-2 ${isDark ? "text-white/50" : "text-[#64748B]"}`}>
            Post, chat, follow, and send payments — all on Solana. Own your data, your identity, and your social graph forever.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-8 w-full sm:w-auto">
            <button
              onClick={login}
              disabled={!ready}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 shadow-xl ${isDark ? "bg-white hover:bg-white/90 text-[#000000] shadow-white/10" : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-blue-200"}`}
            >
              <Wallet className="w-4 h-4" /> Get Started Free
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("features");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium border rounded-xl transition-all ${isDark ? "text-white/60 hover:text-white border-white/10 hover:border-white/20" : "text-[#64748B] hover:text-[#1A1A2E] border-[#E2E8F0] hover:border-[#CBD5E1]"}`}
            >
              See features <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8">
            {[
              { icon: <Lock className="w-3.5 h-3.5 text-[#16A34A]" />, text: "E2E Encrypted Chat" },
              { icon: <Shield className="w-3.5 h-3.5 text-[#2563EB]" />, text: "On-Chain Profiles" },
              { icon: <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />, text: "Gasless for Users" },
              { icon: <Smartphone className="w-3.5 h-3.5 text-[#7C3AED]" />, text: "iOS & Web App" },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-2 text-[11px] ${isDark ? "text-white/40" : "text-[#94A3B8]"}`}>
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Stats */}
      {stats && (
        <div className={`px-4 sm:px-6 py-10 border-t ${isDark ? "border-white/5 bg-white/[0.02]" : "border-[#E2E8F0] bg-white"}`}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Activity className="w-3.5 h-3.5 text-[#16A34A]" />
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? "text-white/30" : "text-[#94A3B8]"}`}>Live On-Chain Stats</p>
              <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              {[
                { label: "Profiles", value: stats.profiles, color: "#2563EB" },
                { label: "Transactions", value: stats.transactions, color: "#16A34A" },
              ].map((stat, i) => (
                <div key={i} className={`rounded-2xl border p-4 text-center ${isDark ? "bg-white/5 border-white/10" : "bg-[#F8FAFC] border-[#E2E8F0]"}`}>
                  <p className="text-2xl sm:text-3xl font-bold" style={{ color: stat.color }}>
                    {stat.value.toLocaleString()}
                  </p>
                  <p className={`text-[10px] mt-1 font-medium ${isDark ? "text-white/30" : "text-[#94A3B8]"}`}>{stat.label}</p>
                </div>
              ))}
            </div>
            <p className={`text-center text-[9px] mt-4 ${isDark ? "text-white/20" : "text-[#CBD5E1]"}`}>Real-time from Solana mainnet</p>
          </div>
        </div>
      )}

      {/* Features */}
      <div id="features" className={`px-4 sm:px-6 md:px-12 py-16 sm:py-20 md:py-28 border-t ${isDark ? "border-white/5" : "border-[#E2E8F0]"}`}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-[#94A3B8]"}`}>What you get</p>
            <h3 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>
              Everything social.{" "}
              <span className={isDark ? "text-white/40" : "text-[#64748B]"}>
                On-chain.
              </span>
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 items-start">
            {/* Feature tabs */}
            <div className="space-y-2">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                const isActive = i === activeFeature;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveFeature(i)}
                    className={`touch-active w-full text-left p-4 rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? isDark ? "bg-white/8 border-white/20 shadow-lg" : "bg-white border-[#2563EB]/20 shadow-lg shadow-blue-100"
                        : isDark ? "bg-white/[0.03] border-white/5 hover:bg-white/5" : "bg-[#F8FAFC] border-[#E2E8F0] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: feature.bgColor }}
                      >
                        <Icon className="w-5 h-5" style={{ color: feature.color }} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>{feature.title}</p>
                        <p className={`text-xs mt-1 transition-all duration-300 ${isActive ? (isDark ? "text-white/60" : "text-[#64748B]") : (isDark ? "text-white/30" : "text-[#94A3B8]")}`}>
                          {feature.description}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <div className="mt-3 h-0.5 bg-gradient-to-r from-[#2563EB] to-[#16A34A] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feature preview card */}
            <div className={`rounded-2xl border p-5 min-h-[280px] sm:min-h-[360px] flex items-center justify-center ${isDark ? "bg-white/5 border-white/10" : "bg-[#F8FAFC] border-[#E2E8F0]"}`}>
              {features[activeFeature].preview.type === "post" && (
                <div className="w-full animate-fade-in">
                  <div className={`rounded-xl border p-4 ${isDark ? "bg-white/5 border-white/10" : "bg-white border-[#E2E8F0] shadow-sm"}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EBF4FF] to-[#E0F2FE] flex items-center justify-center text-lg">😎</div>
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>You</p>
                        <span className="text-[10px] font-medium text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-full">On-Chain</span>
                      </div>
                    </div>
                    <p className={`text-sm ${isDark ? "text-white/70" : "text-[#1A1A2E]"}`}>{features[activeFeature].preview.content}</p>
                    <div className={`mt-3 pt-3 border-t flex items-center gap-3 text-xs ${isDark ? "border-white/5 text-white/30" : "border-[#F1F5F9] text-[#94A3B8]"}`}>
                      <span>❤️ 12</span><span>💬 3</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 justify-center text-[10px] text-[#2563EB]">
                    <Shield className="w-3 h-3" />
                    <span>Stored permanently on Solana — owned by your wallet</span>
                  </div>
                </div>
              )}
              {features[activeFeature].preview.type === "chat" && (
                <div className="w-full space-y-3 animate-fade-in">
                  <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-white/5 border-white/10" : "bg-white border-[#E2E8F0]"}`}>
                    <div className={`px-4 py-3 border-b flex items-center gap-2 ${isDark ? "border-white/5" : "border-[#F1F5F9]"}`}>
                      <div className="w-8 h-8 rounded-full bg-[#EBF4FF] flex items-center justify-center text-sm">👩</div>
                      <div>
                        <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>Alice</p>
                        <p className="text-[10px] text-[#16A34A] flex items-center gap-0.5"><Shield className="w-2 h-2" /> E2E Encrypted</p>
                      </div>
                    </div>
                    <div className="p-4 space-y-2.5">
                      {(features[activeFeature].preview as any).messages.map((msg: any, j: number) => (
                        <div key={j} className={`flex ${msg.sender === "You" ? "justify-end" : "justify-start"}`}>
                          {msg.sender === "system" ? (
                            <div className="bg-gradient-to-r from-[#16A34A] to-[#15803D] text-white px-3 py-2 rounded-xl text-xs font-medium">{msg.text}</div>
                          ) : (
                            <div className={`px-3 py-2 rounded-xl text-xs max-w-[220px] ${msg.sender === "You" ? "bg-[#2563EB] text-white" : isDark ? "bg-white/10 text-white/80" : "bg-[#F1F5F9] text-[#1A1A2E]"}`}>{msg.text}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {features[activeFeature].preview.type === "payment" && (
                <div className="w-full animate-fade-in">
                  <div className={`rounded-xl border p-5 ${isDark ? "bg-white/5 border-white/10" : "bg-white border-[#E2E8F0]"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Wallet className="w-5 h-5 text-[#2563EB]" />
                      <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>Send SOL Instantly</p>
                    </div>
                    <div className="space-y-3">
                      {(features[activeFeature].preview as any).steps.map((step: string, j: number) => (
                        <div key={j} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${j < 2 ? "bg-[#2563EB]" : "bg-[#16A34A]"}`}>{j + 1}</div>
                          <div className={`flex-1 rounded-lg px-3 py-2 ${isDark ? "bg-white/5" : "bg-[#F8FAFC]"}`}>
                            <p className={`text-xs font-medium ${isDark ? "text-white/70" : "text-[#1A1A2E]"}`}>{step}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {features[activeFeature].preview.type === "follows" && (
                <div className="w-full animate-fade-in">
                  <div className={`rounded-xl border p-5 ${isDark ? "bg-white/5 border-white/10" : "bg-white border-[#E2E8F0]"}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-[#16A34A]" />
                      <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>On-Chain Follow Network</p>
                    </div>
                    <div className="space-y-2.5">
                      {["Alice.sol", "Bob.sol", "Charlie.sol"].map((name, j) => (
                        <div key={j} className={`flex items-center gap-3 p-2.5 rounded-xl ${isDark ? "bg-white/5" : "bg-[#F8FAFC]"}`}>
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#EBF4FF] to-[#E0F2FE] flex items-center justify-center text-sm">
                            {["👩", "👨", "🧑"][j]}
                          </div>
                          <div className="flex-1">
                            <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>{name}</p>
                            <p className={`text-[10px] ${isDark ? "text-white/30" : "text-[#94A3B8]"}`}>{j === 0 ? "Follows you · Mutual" : j === 1 ? "Following" : "Follows you"}</p>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${j === 0 ? "bg-[#16A34A]" : "bg-[#2563EB]"}`} />
                        </div>
                      ))}
                    </div>
                    <p className={`text-[10px] text-center mt-3 ${isDark ? "text-white/20" : "text-[#64748B]"}`}>Your social graph lives on Solana forever</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile App Showcase */}
      <div className={`px-4 sm:px-6 md:px-12 py-16 sm:py-20 md:py-28 border-t ${isDark ? "border-white/5 bg-gradient-to-b from-transparent via-blue-950/20 to-transparent" : "border-[#E2E8F0] bg-gradient-to-b from-transparent via-blue-50/50 to-transparent"}`}>
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-center">
            {/* Text side */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full mb-5">
                <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[11px] font-medium text-purple-400">Native iOS App</span>
              </div>
              <h3 className={`text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-4 ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>
                Take your social<br />
                <span className="bg-gradient-to-r from-[#7C3AED] to-[#2563EB] bg-clip-text text-transparent">on the go</span>
              </h3>
              <p className={`text-sm sm:text-base leading-relaxed mb-6 ${isDark ? "text-white/50" : "text-[#64748B]"}`}>
                The full Shyft experience in a native iOS app. Post, chat, send payments — all from your phone with zero wallet popups. Embedded wallet signs silently in the background.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: <Zap className="w-4 h-4 text-[#F59E0B]" />, text: "Silent transaction signing — no popups ever" },
                  { icon: <Lock className="w-4 h-4 text-[#16A34A]" />, text: "Same E2E encryption as the web app" },
                  { icon: <Globe className="w-4 h-4 text-[#2563EB]" />, text: "Synced with web — one identity everywhere" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? "bg-white/5" : "bg-[#F1F5F9]"}`}>{item.icon}</div>
                    <p className={`text-sm ${isDark ? "text-white/60" : "text-[#475569]"}`}>{item.text}</p>
                  </div>
                ))}
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-xl border w-fit ${isDark ? "bg-white/5 border-white/10" : "bg-[#F0FDF4] border-[#DCFCE7]"}`}>
                <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                <span className={`text-xs ${isDark ? "text-white/50" : "text-[#15803D]"}`}>Available now · TestFlight beta</span>
              </div>
            </div>

            {/* Phone mockup side */}
            <div className="flex items-center justify-center">
              <div className="relative">
                {/* Glow behind phone */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl rounded-full scale-150" />
                {/* Phone frame */}
                <div className="relative w-56 sm:w-64 bg-[#0A0A0F] rounded-[3rem] border-2 border-white/15 shadow-2xl overflow-hidden" style={{ aspectRatio: '9/19.5' }}>
                  {/* Notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#0A0A0F] rounded-full z-10 border border-white/10" />
                  {/* Screen content */}
                  <div className="absolute inset-0 bg-[#030712] flex flex-col pt-10 overflow-hidden">
                    {/* App header */}
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <img src="/shyftlogo.png" alt="" className="shyft-logo w-6 h-6 rounded-lg" />
                        <span className="text-white text-xs font-bold">Shyft</span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-[8px]">✏️</span>
                      </div>
                    </div>
                    {/* Feed */}
                    <div className="flex-1 overflow-hidden px-3 py-2 space-y-2">
                      {[
                        { avatar: "🧑‍💻", name: "dev.sol", time: "2m", text: "just deployed my first Solana program 🚀", likes: 24, badge: true },
                        { avatar: "👩‍🎨", name: "art3mis.sol", time: "8m", text: "new NFT drop live! check the link below 🎨", likes: 47, badge: true },
                        { avatar: "🤝", name: "vc.sol", time: "15m", text: "looking for founders building on Solana DM me", likes: 11, badge: true },
                      ].map((post, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/30 to-green-500/30 flex items-center justify-center text-xs">{post.avatar}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-semibold text-white truncate">{post.name}</span>
                                {post.badge && <div className="w-2 h-2 rounded-full bg-[#60A5FA] flex-shrink-0" />}
                              </div>
                              <span className="text-[8px] text-white/30">{post.time} ago</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-white/60 leading-snug">{post.text}</p>
                          <div className="mt-1.5 flex items-center gap-2 text-[8px] text-white/20">
                            <span>❤️ {post.likes}</span><span>💬</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Bottom nav */}
                    <div className="px-4 py-2 flex items-center justify-around border-t border-white/5 bg-[#030712]">
                      {["🏠", "🔍", "➕", "💬", "👤"].map((icon, i) => (
                        <div key={i} className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${i === 0 ? "bg-white/10" : ""}`}>{icon}</div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Side button details */}
                <div className="absolute -right-0.5 top-20 w-1 h-12 bg-white/10 rounded-r-full" />
                <div className="absolute -left-0.5 top-16 w-1 h-8 bg-white/10 rounded-l-full" />
                <div className="absolute -left-0.5 top-28 w-1 h-12 bg-white/10 rounded-l-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className={`px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-t ${isDark ? "border-white/5" : "border-[#E2E8F0] bg-gradient-to-br from-[#EFF6FF] to-[#F0FDF4]"}`}>
        <div className="max-w-4xl mx-auto text-center">
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${isDark ? "text-white/30" : "text-[#94A3B8]"}`}>Simple as that</p>
          <h3 className={`text-2xl sm:text-3xl font-bold mb-10 ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>How Shyft works</h3>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { num: "1", color: "#2563EB", bg: isDark ? "from-blue-500/10" : "from-blue-50", title: "Sign in — zero setup", desc: "Use email, Google, Twitter, or your wallet. We create a secure embedded wallet instantly." },
              { num: "2", color: "#16A34A", bg: isDark ? "from-green-500/10" : "from-green-50", title: "Everything lives on Solana", desc: "Posts, profiles, follows, chats — all on-chain. Your data is permanent and owned by you." },
              { num: "3", color: "#7C3AED", bg: isDark ? "from-purple-500/10" : "from-purple-50", title: "Gas fees? We got you", desc: "The platform sponsors all transaction fees. Use Shyft without ever needing SOL in your wallet." },
            ].map((step, i) => (
              <div key={i} className={`bg-gradient-to-b ${step.bg} to-transparent rounded-2xl p-5 border text-left ${isDark ? "border-white/10" : "border-[#E2E8F0] bg-white shadow-sm"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${isDark ? "bg-white/5" : "bg-white shadow-sm border border-[#E2E8F0]"}`}>
                  <span className="text-lg font-bold" style={{ color: step.color }}>{step.num}</span>
                </div>
                <h4 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>{step.title}</h4>
                <p className={`text-xs leading-relaxed ${isDark ? "text-white/40" : "text-[#64748B]"}`}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Partners */}
      <div className={`px-4 sm:px-6 md:px-12 py-12 sm:py-14 border-t ${isDark ? "border-white/5" : "border-[#E2E8F0] bg-white"}`}>
        <div className="max-w-3xl mx-auto text-center">
          <p className={`text-[10px] font-semibold uppercase tracking-widest mb-8 ${isDark ? "text-white/20" : "text-[#94A3B8]"}`}>Our Partners</p>
          <div className="flex items-center justify-center flex-wrap gap-8 sm:gap-14">
            {[
              { href: "https://privy.io", img: "/privy.jpg", name: "Privy", sub: "Wallet Infrastructure" },
              { href: "https://bags.fm", img: "/bags.jpg", name: "Bags.fm", sub: "Token Launches" },
              { href: "https://pinata.cloud", img: "/pinata.jpg", name: "Pinata", sub: "Media Infrastructure" },
              { href: "https://magicblock.gg", img: "/magicblock.jpg", name: "MagicBlock", sub: "Private Payments" },
            ].map((p, i) => (
              <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group opacity-50 hover:opacity-100 transition-opacity">
                <div className={`w-12 h-12 rounded-2xl overflow-hidden border transition-all ${isDark ? "border-white/10 group-hover:border-white/20" : "border-[#E2E8F0] group-hover:border-[#2563EB]/30 group-hover:shadow-lg"}`}>
                  <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="text-center">
                  <p className={`text-xs font-bold ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>{p.name}</p>
                  <p className={`text-[9px] ${isDark ? "text-white/30" : "text-[#94A3B8]"}`}>{p.sub}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className={`relative px-4 sm:px-6 md:px-12 py-16 sm:py-20 border-t overflow-hidden ${isDark ? "border-white/5" : "border-[#E2E8F0] bg-white"}`}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-blue-600/10 blur-[80px]" />
        </div>
        <div className="relative z-10 text-center max-w-xl mx-auto">
          <img src="/shyftlogo.png" alt="Shyft" className="shyft-logo w-14 h-14 mx-auto mb-5" />
          <h3 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-3 ${isDark ? "text-white" : "text-[#1A1A2E]"}`}>Ready to own your social?</h3>
          <p className={`text-sm mb-8 max-w-md mx-auto ${isDark ? "text-white/40" : "text-[#64748B]"}`}>Sign in with email, Google, Twitter, or your Solana wallet — and join the first fully on-chain social platform.</p>
          <button
            onClick={login}
            disabled={!ready}
            className={`flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-xl transition-all disabled:opacity-50 shadow-2xl mx-auto ${isDark ? "bg-white hover:bg-white/90 text-[#000000] shadow-white/10" : "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-blue-200"}`}
          >
            <Wallet className="w-5 h-5" /> Get Started — It&apos;s Free
          </button>
          <p className={`text-[9px] mt-5 ${isDark ? "text-white/15" : "text-[#94A3B8]"}`}>
            Program: EEnouVLAoQGMEbrypEhP3Ct5RgCViCWG4n1nCZNwMxjQ · Solana Mainnet
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className={`px-4 sm:px-6 md:px-12 py-5 border-t ${isDark ? "border-white/5 bg-white/[0.01]" : "border-[#E2E8F0] bg-[#F8FAFC]"}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <img src="/shyftlogo.png" alt="Shyft" className="shyft-logo w-6 h-6" />
            <span className={`text-xs font-semibold ${isDark ? "text-white/40" : "text-[#64748B]"}`}>Shyft</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="/docs" className={`transition-colors text-xs font-medium ${isDark ? "text-white/25 hover:text-white/60" : "text-[#94A3B8] hover:text-[#1A1A2E]"}`}>Docs</a>
            <a href="https://x.com/Shyft_lol" target="_blank" rel="noopener noreferrer" className={`transition-colors ${isDark ? "text-white/25 hover:text-white/60" : "text-[#94A3B8] hover:text-[#1A1A2E]"}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/chandm1213/Shyft.lol" target="_blank" rel="noopener noreferrer" className={`transition-colors ${isDark ? "text-white/25 hover:text-white/60" : "text-[#94A3B8] hover:text-[#1A1A2E]"}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
            <p className={`text-[9px] ${isDark ? "text-white/15" : "text-[#94A3B8]"}`}>Fully on-chain social · Built on Solana</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
