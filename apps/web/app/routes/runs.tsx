import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { AppLayout } from "../components/app-layout";
import { AXIOS_INSTANCE } from "../lib/api/axios";
import { AgentRunSchema } from "../lib/schemas";
import { StatusBadge } from "../components/ui/status-badge";
import { PageHeader } from "../components/ui/page-header";
import { LoadingState, EmptyState, ErrorState } from "../components/ui/states";
import { Pagination } from "../components/ui/pagination";

const fetchRuns = async (page: number, limit: number) => {
  const response = await AXIOS_INSTANCE.get("/api/runs", {
    params: { page, limit },
  });
  return response.data;
};

export default function Runs() {
  const [searchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;

  const { data: runsResponse, isLoading, isError } = useQuery({
    queryKey: ["/api/runs", currentPage, limit],
    queryFn: () => fetchRuns(currentPage, limit),
  });

  const runs = z.array(AgentRunSchema).safeParse(runsResponse?.data).data || [];
  // @ts-ignore - API response might not be typed correctly yet
  const meta = runsResponse?.meta || { total: 0, page: 1, limit: 20 };
  const totalPages = Math.ceil((meta.total || 0) / limit);

  return (
    <AppLayout>
      <PageHeader 
        title="Runs" 
        description="History of all agent execution runs" 
      />

      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading runs..." />
        ) : isError ? (
          <ErrorState message="Error loading runs" />
        ) : runs.length === 0 ? (
          <EmptyState message="No runs found" />
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-950/50 text-xs uppercase font-medium text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4">Run ID</th>
                  <th className="px-6 py-4">Agent</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-right">Duration</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {run.id.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {run.agentName}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-6 py-4">
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/runs/${run.id}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        View Details &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination totalPages={totalPages} className="mb-6" />
        </>
        )}
      </div>
    </AppLayout>
  );
}
