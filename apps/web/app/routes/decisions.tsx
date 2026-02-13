import { Link, useSearchParams } from "react-router";
import { useDecisionsControllerListDecisions } from "../lib/api/decisions/decisions";
import { DecisionSchema } from "../lib/schemas";
import { z } from "zod";
import { AppLayout } from "../components/app-layout";
import { Pagination } from "../components/ui/pagination";
import { StatusBadge } from "../components/ui/status-badge";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState, LoadingState, ErrorState } from "../components/ui/states";

type DecisionParsed = z.infer<typeof DecisionSchema>;

export default function Decisions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";
  const currentPage = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;

  const { data: decisionsResponse, isLoading, isError } = useDecisionsControllerListDecisions({
    status: currentStatus !== 'all' ? currentStatus : 'all',
    page: currentPage,
    limit: limit,
  });

  const decisions = z.array(DecisionSchema).safeParse(decisionsResponse?.data).data || [];
  // @ts-ignore - The generated types might not include meta yet
  const meta = decisionsResponse?.meta || { total: 0, page: 1, limit: 20 };
  const totalPages = Math.ceil((meta.total || 0) / limit);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParams = new URLSearchParams(searchParams);
    if (e.target.value === 'all') {
      newParams.delete("status");
    } else {
      newParams.set("status", e.target.value);
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  if (isLoading) return <AppLayout><LoadingState message="Loading decisions..." /></AppLayout>;
  if (isError) return <AppLayout><ErrorState message="Failed to load decisions" /></AppLayout>;

  const activeCount = decisions.filter(d => d.status === 'active').length;
  const supersededCount = decisions.filter(d => d.status === 'superseded').length;

  return (
    <AppLayout>
        <PageHeader 
          title="Decisions" 
          description={
            <>
              <p className="text-gray-400 mt-2">Track key decisions and their rationale</p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-green-400">{activeCount} active</span>
                <span className="text-gray-500">{supersededCount} superseded</span>
              </div>
            </>
          }
        >
          <div className="flex gap-4">
            <select
              value={currentStatus}
              onChange={handleStatusChange}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="superseded">Superseded</option>
              <option value="proposed">Proposed</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </PageHeader>

        <section className="mt-6">
          {isLoading ? (
            <LoadingState message="Loading decisions..." />
          ) : decisions.length === 0 ? (
            <EmptyState message="No decisions found." />
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {decisions.map((decision) => (
                  <DecisionCard key={decision.id} decision={decision} allDecisions={decisions} />
                ))}
              </div>
              <Pagination totalPages={totalPages} />
            </>
          )}
        </section>
    </AppLayout>
  );
}

function DecisionCard({ decision, allDecisions }: { decision: DecisionParsed; allDecisions: DecisionParsed[] }) {
  const supersedingDecision = decision.supersededBy
    ? allDecisions.find(d => d.id === decision.supersededBy)
    : null;

  return (
    <div className={`bg-gray-900 rounded-xl border overflow-hidden hover:border-gray-700 transition-colors flex flex-col p-6 ${
      decision.status === 'superseded' ? 'border-gray-800/50 opacity-75' : 'border-gray-800'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-lg font-semibold text-white line-clamp-2">
          {decision.title || decision.content.title || 'Untitled Decision'}
        </h2>
        <StatusBadge status={decision.status} />
      </div>
      
      <p className="text-gray-300 mb-4 text-sm leading-relaxed line-clamp-3">
        {decision.summary || decision.content.description || ''}
      </p>

      {decision.impactArea && decision.impactArea.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {decision.impactArea.map((area) => (
            <span key={area} className="px-2 py-0.5 text-xs rounded-full bg-blue-900/30 text-blue-400 border border-blue-900/50">
              {area}
            </span>
          ))}
        </div>
      )}

      {decision.status === 'superseded' && decision.supersededBy && (
        <div className="mb-4 text-xs text-gray-500 bg-gray-950/50 p-2.5 rounded border border-gray-800/50">
          <span className="text-gray-600">Superseded by: </span>
          <Link to={`/decisions?id=${decision.supersededBy}`} className="text-blue-400 hover:underline">
            {supersedingDecision?.title || supersedingDecision?.content.title || decision.supersededBy.slice(0, 8)}
          </Link>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-gray-800 flex justify-between items-end text-xs text-gray-500">
        <div>
          <div className="mb-1">
            {decision.createdBy === 'AI' ? (
              <span className="text-purple-400">AI detected</span>
            ) : (
              <>Decided by <span className="text-gray-300">{decision.decidedBy || 'Unknown'}</span></>
            )}
          </div>
          <div>{decision.createdAt ? new Date(decision.createdAt).toLocaleDateString() : ''}</div>
        </div>
        <div className="flex items-center gap-2">
          {decision.sourceRefs && decision.sourceRefs.length > 0 && (
            <div className="flex items-center gap-1 bg-gray-800 px-2 py-1 rounded text-gray-300">
              <span>{decision.sourceRefs.length}</span>
              <span>refs</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
