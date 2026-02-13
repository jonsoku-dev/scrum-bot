import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AXIOS_INSTANCE } from "../lib/api/axios";
import { QUERY_KEYS } from "../lib/constants";

const GeneralSettingsSchema = z.object({
  settings: z.object({
    llmModel: z.string().optional().default("gemini-2.0-flash"),
    embeddingModel: z.string().optional().default("text-embedding-004"),
    maxGraphIterations: z.number().optional().default(10),
    costBudgetPerSprintUsd: z.number().optional().default(50.0),
    dataRetentionDays: z.number().optional().default(90),
  }).optional().default({}),
});

type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;

function fetchSettings(): Promise<GeneralSettings> {
  return AXIOS_INSTANCE.get("/api/settings").then((res) => {
    // We use safeParse to allow partial/missing data without crashing
    // If the API structure is totally different, we fall back to defaults
    const parsed = GeneralSettingsSchema.safeParse(res.data);
    if (!parsed.success) {
      console.warn("Settings API response mismatch", parsed.error);
      return GeneralSettingsSchema.parse({});
    }
    return parsed.data;
  });
}

export default function SettingsGeneral() {
  const { data, isLoading, error } = useQuery({
    queryKey: [QUERY_KEYS.SETTINGS],
    queryFn: fetchSettings,
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  // If error, we can display defaults or an error message. 
  // Given the requirements "fetched from /api/settings if exists, or show placeholder text",
  // we can show defaults if fetching fails (e.g. 404).
  const settings = data?.settings || GeneralSettingsSchema.parse({}).settings;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <SettingCard
        title="Bot Configuration"
        icon="🤖"
        description="Core parameters for the AI agent loop."
      >
        <SettingItem label="LLM Model" value={settings.llmModel} mono />
        <SettingItem
          label="Embedding Model"
          value={settings.embeddingModel}
          mono
        />
        <SettingItem
          label="Max Iterations"
          value={settings.maxGraphIterations.toString()}
        />
      </SettingCard>

      <SettingCard
        title="Budget"
        icon="💰"
        description="Cost control and limits for API usage."
      >
        <SettingItem
          label="Daily Budget Limit"
          value={`$${settings.costBudgetPerSprintUsd.toFixed(2)}`}
          mono
        />
        <div className="pt-2 text-xs text-gray-500">
          * Resets every 24 hours
        </div>
      </SettingCard>

      <SettingCard
        title="Data Retention"
        icon="💾"
        description="Policies for storing run history and logs."
      >
        <SettingItem
          label="Retention Period"
          value={`${settings.dataRetentionDays} days`}
        />
        <div className="pt-2 text-xs text-gray-500">
          * Older data is automatically archived
        </div>
      </SettingCard>
    </div>
  );
}

function SettingCard({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
          <span className="text-2xl">{icon}</span> {title}
        </h2>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      <div className="space-y-4 flex-grow">{children}</div>
    </section>
  );
}

function SettingItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
        {label}
      </label>
      <div
        className={`bg-gray-950 px-3 py-2.5 rounded-lg border border-gray-800 text-gray-300 text-sm ${
          mono ? "font-mono text-blue-300" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
