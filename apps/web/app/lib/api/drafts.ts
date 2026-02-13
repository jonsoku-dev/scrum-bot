import { api } from "../api";
import type { Draft } from "../../types";

export const draftsApi = {
  fetchDrafts: async (status?: string, type?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append("status", status);
    if (type && type !== 'all') params.append("type", type);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const { data } = await api.get<{ data: Draft[] }>(`/api/drafts${queryString}`);
    return data.data || [];
  },

  fetchPendingDrafts: async () => {
    const { data } = await api.get<{ data: Draft[] }>('/api/drafts?status=pending');
    return data.data || [];
  },

  fetchDraft: async (id: string) => {
    const { data } = await api.get<{ data: Draft }>(`/api/drafts/${id}`);
    return data.data;
  },

  updateDraft: async (id: string, content: { summary: string; descriptionMd: string }) => {
    await api.patch(`/api/drafts/${id}`, {
      content
    });
    return { success: true };
  },

  approveDraft: async (id: string) => {
    await api.post(`/api/drafts/${id}/approve`, { approvedBy: 'web-user' });
    return { success: true, message: "Draft approved" };
  },

  rejectDraft: async (id: string) => {
    await api.post(`/api/drafts/${id}/reject`);
    return { success: true, message: "Draft rejected" };
  }
};
