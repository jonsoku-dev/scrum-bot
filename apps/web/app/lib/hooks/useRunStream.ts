import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, QUERY_KEYS } from '../constants';
import { AgentRunSchema } from '../schemas';
import { z } from 'zod';

type AgentRun = z.infer<typeof AgentRunSchema>;

export function useRunStream(runId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!runId) return;

    const eventSource = new EventSource(`${API_BASE_URL}/api/runs/${runId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'update' && data.run) {
            const parsedRun = AgentRunSchema.safeParse(data.run);
            
            if (parsedRun.success) {
                queryClient.setQueryData<AgentRun[]>(
                    [QUERY_KEYS.RUNS, runId, 'timeline'],
                    (old) => {
                    if (!old) return [parsedRun.data];
                    const index = old.findIndex((r) => r.id === parsedRun.data.id);
                    if (index >= 0) {
                        const newRuns = [...old];
                        newRuns[index] = parsedRun.data;
                        return newRuns;
                    }
                    return [...old, parsedRun.data];
                    }
                );
            }
        }
      } catch (e) {
        console.error('SSE parse error', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId, queryClient]);
}
