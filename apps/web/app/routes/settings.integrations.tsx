import { useQuery } from "@tanstack/react-query";
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

export default function SettingsIntegrations() {
  const { data, isLoading, error } = useQuery({
    queryKey: [QUERY_KEYS.SETTINGS],
    queryFn: fetchSettings,
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading integrations...</p>
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
    <div className="grid gap-8 md:grid-cols-2">
      <ConnectionCard
        title="Slack Connection"
        icon={"\uD83D\uDCAC"}
        connected={data?.connections.slack.connected ?? false}
        details={[
          {
            label: "Status",
            value: data?.connections.slack.connected ? "Connected" : "Not configured",
            mono: false,
          },
        ]}
        scopes={["channels:history", "groups:history", "reactions:read", "chat:write", "commands"]}
      />

      <ConnectionCard
        title="Jira Connection"
        icon={"\uD83C\uDFAB"}
        connected={data?.connections.jira.connected ?? false}
        details={[
          {
            label: "Base URL",
            value: data?.connections.jira.baseUrl ?? "Not configured",
            mono: true,
          },
        ]}
        scopes={["read:jira-work", "write:jira-work", "read:jira-user"]}
      />
    </div>
  );
}

function ConnectionCard({
  title,
  icon,
  connected,
  details,
  scopes,
}: {
  title: string;
  icon: string;
  connected: boolean;
  details: Array<{ label: string; value: string; mono?: boolean }>;
  scopes?: string[];
}) {
  return (
    <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <span className="text-2xl">{icon}</span> {title}
      </h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-gray-950 p-4 rounded-lg border border-gray-800">
          <span className="text-gray-400">Status</span>
          <span
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
              connected
                ? "bg-green-900/30 text-green-500 border-green-900/50"
                : "bg-red-900/30 text-red-500 border-red-900/50"
            }`}
          >
            {connected ? "\u25CF Connected" : "\u25CB Disconnected"}
          </span>
        </div>
        {details.map((detail) => (
          <div key={detail.label} className="space-y-2">
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              {detail.label}
            </label>
            <div
              className={`bg-gray-950 p-3 rounded border border-gray-800 text-gray-300 text-sm ${
                detail.mono ? "font-mono" : ""
              }`}
            >
              {detail.value}
            </div>
          </div>
        ))}
        {scopes && scopes.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-gray-800">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Required Scopes</label>
            <div className="flex flex-wrap gap-2">
              {scopes.map(scope => (
                <span key={scope} className="px-2 py-1 bg-gray-950 text-gray-400 rounded-md text-xs border border-gray-800 font-mono shadow-sm">
                  {scope}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
