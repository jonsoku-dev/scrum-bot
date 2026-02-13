import React from "react";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className = "" }: PageHeaderProps) {
  return (
    <header className={`border-b border-gray-800 pb-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 ${className}`}>
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          {title}
        </h1>
        {description && <div className="text-gray-400 mt-2">{description}</div>}
      </div>
      {children && (
        <div className="flex gap-4 items-center">
          {children}
        </div>
      )}
    </header>
  );
}
