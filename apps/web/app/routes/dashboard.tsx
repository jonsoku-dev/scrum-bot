import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { z } from "zod";
import { AppLayout } from "../components/app-layout";
import { useDecisionsControllerListDecisions } from "../lib/api/decisions/decisions";
import { useDraftsControllerListDrafts } from "../lib/api/drafts/drafts";
import { DecisionSchema, DraftSchema, AgentRunSchema } from "../lib/schemas";
import { AXIOS_INSTANCE } from "../lib/api/axios";
import { ROUTES } from "../lib/constants";
import { StatusBadge } from "../components/ui/status-badge";

const fetchRuns = async () => {
  const response = await AXIOS_INSTANCE.get("/api/runs");
  return response.data;
};

export default function Dashboard() {
  const { data: decisionsResponse, isLoading: isLoadingDecisions } = useDecisionsControllerListDecisions({ status: "all" });
  const decisions = z.array(DecisionSchema).safeParse(decisionsResponse).data || [];
  const recentDecisions = decisions.slice(0, 5);

  const { data: draftsResponse, isLoading: isLoadingDrafts } = useDraftsControllerListDrafts({ status: "pending" });
  const pendingDrafts = z.array(DraftSchema).safeParse(draftsResponse).data || [];

  const { data: runsResponse, isLoading: isLoadingRuns, isError: isRunsError } = useQuery({
    queryKey: ["/api/runs"],
    queryFn: fetchRuns,
    retry: false,
  });
  
  const runs = z.array(AgentRunSchema).safeParse(runsResponse).data || [];
  const recentRuns = runs.slice(0, 5);

  return (
    <AppLayout>
      <header className="border-b border-gray-800 pb-6 mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-gray-400 mt-2">Overview of decisions, drafts, and agent activity</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Today's Decisions</h2>
            <Link to={ROUTES.DECISIONS} className="text-sm text-blue-400 hover:text-blue-300">View All &rarr;</Link>
          </div>
          
          {isLoadingDecisions ? (
            <div className="py-8 text-center text-gray-500">Loading decisions...</div>
          ) : recentDecisions.length === 0 ? (
             <div className="py-8 text-center text-gray-500 border border-gray-800 border-dashed rounded-lg">
               No decisions recorded recently.
             </div>
          ) : (
            <div className="space-y-3">
              {recentDecisions.map(decision => (
                <div key={decision.id} className="p-4 bg-gray-950 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-white font-medium mb-1">{decision.content?.title || "Untitled Decision"}</h3>
                      <p className="text-sm text-gray-400 line-clamp-1">{decision.content?.description}</p>
                    </div>
                    <StatusBadge status={decision.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              Draft Queue
              <span className="bg-yellow-900/30 text-yellow-500 text-xs px-2 py-0.5 rounded-full border border-yellow-900/50">
                {pendingDrafts.length}
              </span>
            </h2>
            <Link to={ROUTES.DRAFTS} className="text-sm text-blue-400 hover:text-blue-300">View All &rarr;</Link>
          </div>

          {isLoadingDrafts ? (
            <div className="py-8 text-center text-gray-500">Loading drafts...</div>
          ) : pendingDrafts.length === 0 ? (
            <div className="py-8 text-center text-gray-500 border border-gray-800 border-dashed rounded-lg">
              No pending drafts.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingDrafts.slice(0, 5).map(draft => (
                <Link to={`/drafts/${draft.id}`} key={draft.id} className="block group">
                  <div className="p-4 bg-gray-950 rounded-lg border border-gray-800 group-hover:border-blue-500/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-gray-500 uppercase">{draft.type}</span>
                      <span className="text-xs text-gray-500">{new Date(draft.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors line-clamp-1">
                      {draft.content?.summary}
                    </h3>
                  </div>
                </Link>
              ))}
              {pendingDrafts.length > 5 && (
                <div className="text-center pt-2">
                  <span className="text-sm text-gray-500">and {pendingDrafts.length - 5} more...</span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg lg:col-span-2">
           <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Runs</h2>
          </div>

          {isLoadingRuns ? (
            <div className="py-8 text-center text-gray-500">Loading runs...</div>
          ) : isRunsError || runs.length === 0 ? (
             <div className="py-12 text-center bg-gray-950/50 rounded-lg border border-gray-800 border-dashed">
               <p className="text-gray-400 mb-2">Run history available in /runs</p>
               {isRunsError && <p className="text-xs text-red-900/50">Could not load recent runs list.</p>}
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-950/50 text-xs uppercase font-medium text-gray-500">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Agent</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {recentRuns.map(run => (
                    <tr key={run.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{run.agentName}</td>
                      <td className="px-4 py-3">
                         <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3">{new Date(run.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}


