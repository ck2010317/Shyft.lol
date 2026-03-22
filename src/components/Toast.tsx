"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Shield, X, Info } from "lucide-react";
import { create } from "zustand";

interface Toast {
  id: string;
  type: "success" | "error" | "info" | "privacy";
  title: string;
  message?: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function toast(type: Toast["type"], title: string, message?: string) {
  useToastStore.getState().addToast({ type, title, message });
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 4000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-[#16A34A]" />,
    error: <XCircle className="w-5 h-5 text-[#DC2626]" />,
    info: <Info className="w-5 h-5 text-[#2563EB]" />,
    privacy: <Shield className="w-5 h-5 text-[#16A34A]" />,
  };

  const bgColors = {
    success: "bg-[#F0FDF4] border-[#DCFCE7]",
    error: "bg-red-50 border-red-200",
    info: "bg-[#EFF6FF] border-[#DBEAFE]",
    privacy: "bg-[#F0FDF4] border-[#DCFCE7]",
  };

  return (
    <div className={`flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border shadow-lg ${bgColors[toast.type]} animate-slide-in w-[calc(100vw-24px)] sm:w-auto sm:max-w-sm`}>
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-[#1A1A2E]">{toast.title}</p>
        {toast.message && <p className="text-[10px] sm:text-xs text-[#64748B] mt-0.5 break-words">{toast.message}</p>}
      </div>
      <button onClick={onRemove} className="flex-shrink-0 text-[#94A3B8] hover:text-[#64748B] p-0.5">
        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-3 left-3 right-3 sm:left-auto sm:top-4 sm:right-4 z-50 space-y-2 flex flex-col items-center sm:items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
