import { api } from "../api";
import type { Decision } from "../../types";

export const decisionsApi = {
  fetchDecisions: async (status?: string) => {
    let url = '/api/decisions';
    if (status && status !== 'all') {
      url += `?status=${status}`;
    }
    
    const { data } = await api.get<{ data: Decision[] }>(url);
    return data.data || [];
  }
};
