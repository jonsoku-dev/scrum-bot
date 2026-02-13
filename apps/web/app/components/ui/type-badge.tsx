import React from "react";

interface TypeBadgeProps {
  type?: string | null;
  className?: string;
}

const TYPE_STYLES: Record<string, string> = {
  jira_ticket: "bg-blue-900/30 text-blue-400 border-blue-900/50",
  decision: "bg-green-900/30 text-green-400 border-green-900/50",
  action_item: "bg-yellow-900/30 text-yellow-400 border-yellow-900/50",
  meeting_summary: "bg-purple-900/30 text-purple-400 border-purple-900/50",
};

const TYPE_LABELS: Record<string, string> = {
  jira_ticket: "Jira Ticket",
  decision: "Decision",
  action_item: "Action Item",
  meeting_summary: "Meeting Summary",
};

export function TypeBadge({ type, className = "" }: TypeBadgeProps) {
  if (!type) return null;

  const style = TYPE_STYLES[type] || "bg-gray-800 text-gray-400 border-gray-700";
  const label = TYPE_LABELS[type] || type;

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}
    >
      {label}
    </span>
  );
}
