import React from "react";

type StatusVariant = "success" | "warning" | "error" | "info" | "default";

interface StatusBadgeProps {
  status?: string | null;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-900/30 text-green-500 border-green-900/50",
  completed: "bg-green-900/30 text-green-500 border-green-900/50",
  active: "bg-green-900/30 text-green-500 border-green-900/50",
  success: "bg-green-900/30 text-green-500 border-green-900/50",
  
  pending: "bg-yellow-900/30 text-yellow-500 border-yellow-900/50",
  proposed: "bg-yellow-900/30 text-yellow-500 border-yellow-900/50",
  processing: "bg-yellow-900/30 text-yellow-500 border-yellow-900/50",
  
  rejected: "bg-red-900/30 text-red-500 border-red-900/50",
  revoked: "bg-red-900/30 text-red-500 border-red-900/50",
  failed: "bg-red-900/30 text-red-500 border-red-900/50",
  aborted: "bg-red-900/30 text-red-500 border-red-900/50",
  
  running: "bg-blue-900/30 text-blue-500 border-blue-900/50",
  executed: "bg-blue-900/30 text-blue-500 border-blue-900/50",
  
  superseded: "bg-gray-800 text-gray-400 border-gray-700 line-through",
  default: "bg-gray-800 text-gray-400 border-gray-700",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  if (!status) return null;
  
  const normalizedStatus = status.toLowerCase();
  const style = STATUS_STYLES[normalizedStatus] || STATUS_STYLES.default;
  
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${style} ${className}`}
    >
      {status}
    </span>
  );
}
