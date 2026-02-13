import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AXIOS_INSTANCE } from "../lib/api/axios";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorState } from "../components/ui/ErrorState";
import { EmptyState } from "../components/ui/EmptyState";

interface Prompt {
  name: string;
  version: string;
  description: string;
  content: string;
}

function fetchPrompts(): Promise<Prompt[]> {
  return AXIOS_INSTANCE.get("/api/settings/prompts").then((res) => res.data.prompts);
}

export default function SettingsPrompts() {
  const { data: prompts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["settings", "prompts"],
    queryFn: fetchPrompts,
  });

  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingState message="Loading prompts..." />;
  }

  if (isError) {
    return (
      <ErrorState 
        title="Failed to load prompts" 
        message="Could not fetch prompt configurations from the server."
        retry={refetch}
      />
    );
  }

  if (prompts.length === 0) {
    return (
      <EmptyState 
        title="No prompts found" 
        description="There are no prompt configurations available at the moment."
      />
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {prompts.map((prompt) => (
        <div
          key={prompt.name}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg hover:border-gray-700 transition-colors flex flex-col"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-mono text-lg font-semibold text-white">
              {prompt.name}
            </h3>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-blue-900/30 text-blue-400 border border-blue-900/50">
              {prompt.version}
            </span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mb-4 flex-grow">
            {prompt.description}
          </p>

          <div className="mt-auto pt-4 border-t border-gray-800">
            {expandedPrompt === prompt.name ? (
               <div className="mb-4 bg-gray-950 rounded border border-gray-800 p-3 overflow-x-auto">
                 <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                   {prompt.content}
                 </pre>
               </div>
            ) : null}
            
            <div className="flex justify-end">
                <button 
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer"
                  onClick={() => setExpandedPrompt(expandedPrompt === prompt.name ? null : prompt.name)}
                >
                  {expandedPrompt === prompt.name ? "Hide Source" : "View Source"} 
                  <span>{expandedPrompt === prompt.name ? "↑" : "→"}</span>
                </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
