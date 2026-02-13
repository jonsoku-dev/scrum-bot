import { api } from "../api";
import type { AgentRun } from "../../types";

export const runsApi = {
  fetchRun: async (runId: string) => {
    const { data } = await api.get<{ data: { run: AgentRun, relatedRuns: AgentRun[] } }>(`/api/runs/${runId}`);
    return { run: data.data.run, allRuns: data.data.relatedRuns || [] };
  }
};
