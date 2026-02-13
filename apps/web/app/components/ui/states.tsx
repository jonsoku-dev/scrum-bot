import React from "react";

interface StateProps {
  message?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({ message, children, className = "" }: StateProps) {
  return (
    <div className={`text-center py-12 bg-gray-900/50 rounded-xl border border-gray-800 border-dashed ${className}`}>
      {message && <p className="text-gray-500">{message}</p>}
      {children}
    </div>
  );
}

export function LoadingState({ message = "Loading...", className = "" }: StateProps) {
  return (
    <div className={`text-center py-12 text-gray-500 ${className}`}>
      {message}
    </div>
  );
}

export function ErrorState({ message = "An error occurred", className = "" }: StateProps) {
  return (
    <div className={`text-center py-12 text-red-500 ${className}`}>
      {message}
    </div>
  );
}
