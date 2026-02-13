import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AXIOS_INSTANCE } from "../lib/api/axios";
import { QUERY_KEYS } from "../lib/constants";

const SettingsResponseSchema = z.object({
  settings: z.object({
    decisionKeywords: z.array(z.string()),
    confidenceThreshold: z.number(),
    maxGraphIterations: z.number(),
    costBudgetPerSprintUsd: z.number(),
  }),
  connections: z.object({
    slack: z.object({
      connected: z.boolean(),
    }),
    jira: z.object({
      connected: z.boolean(),
      baseUrl: z.string().nullable(),
    }),
  }),
});

type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

function fetchSettings(): Promise<SettingsResponse> {
  return AXIOS_INSTANCE.get("/api/settings").then((res) => {
    const parsed = SettingsResponseSchema.safeParse(res.data);
    if (!parsed.success) throw new Error("Invalid settings response");
    return parsed.data;
  });
}

function saveSettings(body: Record<string, unknown>) {
  return AXIOS_INSTANCE.put("/api/settings", body).then((res) => res.data);
}

export default function SettingsPolicies() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: [QUERY_KEYS.SETTINGS],
    queryFn: fetchSettings,
  });

  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.85);
  const [maxGraphIterations, setMaxGraphIterations] = useState(5);
  const [costBudget, setCostBudget] = useState(10);

  useEffect(() => {
    if (data) {
      setKeywords(data.settings.decisionKeywords);
      setConfidenceThreshold(data.settings.confidenceThreshold);
      setMaxGraphIterations(data.settings.maxGraphIterations);
      setCostBudget(data.settings.costBudgetPerSprintUsd);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.SETTINGS] });
      showToast("success", "Settings saved successfully");
    },
    onError: () => {
      showToast("error", "Failed to save settings");
    },
  });

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  function handleAddKeyword() {
    const trimmed = newKeyword.trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    setKeywords([...keywords, trimmed]);
    setNewKeyword("");
  }

  function handleRemoveKeyword(keyword: string) {
    setKeywords(keywords.filter((k) => k !== keyword));
  }

  function handleKeywordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  }

  function handleSave() {
    mutation.mutate({
      decisionKeywords: keywords,
      confidenceThreshold,
      maxGraphIterations,
      costBudgetPerSprintUsd: costBudget,
    });
  }

  const hasChanges =
    data &&
    (JSON.stringify(keywords) !==
      JSON.stringify(data.settings.decisionKeywords) ||
      confidenceThreshold !== data.settings.confidenceThreshold ||
      maxGraphIterations !== data.settings.maxGraphIterations ||
      costBudget !== data.settings.costBudgetPerSprintUsd);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading policies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-red-900/10 rounded-xl border border-red-900/30">
        <p className="text-red-400">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={mutation.isPending || !hasChanges}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
        >
          {mutation.isPending ? (
            <>
              <span className="animate-spin">&#x27F3;</span> Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>

      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-xl border transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-900/80 text-green-300 border-green-800"
              : "bg-red-900/80 text-red-300 border-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg md:col-span-2">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <span className="text-2xl">{"\uD83D\uDEE1\uFE0F"}</span> System
          Policies
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Decision Detection Keywords
            </h3>
            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
              <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/20 text-blue-400 rounded text-xs border border-blue-900/30 group"
                  >
                    {keyword}
                    <button
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="text-blue-400/50 hover:text-red-400 transition-colors"
                      aria-label={`Remove ${keyword}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder="Add keyword..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <button
                  onClick={handleAddKeyword}
                  disabled={!newKeyword.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Confidence Threshold
              </h3>
              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(confidenceThreshold * 100)}
                    onChange={(e) =>
                      setConfidenceThreshold(Number(e.target.value) / 100)
                    }
                    className="flex-1 h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-sm text-white font-mono w-12 text-right">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Max Graph Iterations
              </h3>
              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxGraphIterations}
                  onChange={(e) =>
                    setMaxGraphIterations(
                      Math.max(1, Math.min(50, Number(e.target.value)))
                    )
                  }
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Cost Budget per Sprint
              </h3>
              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={costBudget}
                    onChange={(e) =>
                      setCostBudget(Math.max(0, Number(e.target.value)))
                    }
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-12 py-2 text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    USD
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
