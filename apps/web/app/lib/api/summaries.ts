import { api } from "../api";
import type { Summary } from "../../types";

export const summariesApi = {
  fetchSummaries: async () => {
    const { data } = await api.get<{ data: Summary[] }>('/api/summaries');
    return data.data || [];
  },

  createSummary: async (channelId: string) => {
    const { data } = await api.post('/api/summarize', { channelId, messageCount: 100 });
    return data;
  }
};
