"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({ open, onClose, title, children, className, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full rounded-2xl border shadow-2xl",
          sizeClass[size],
          className
        )}
        style={{ background: "#141418", borderColor: "#1E1E28" }}
      >
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: "#1E1E28" }}>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-[#1E1E28]"
            style={{ color: "#8B8FA8" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 10rem)" }}>{children}</div>
      </div>
    </div>
  );
}
