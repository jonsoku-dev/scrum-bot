import { Link, useParams } from "react-router";
import { useDecisionsControllerGetDecision } from "../lib/api/decisions/decisions";
import { DecisionSchema } from "../lib/schemas";
import { z } from "zod";
import { AppLayout } from "../components/app-layout";
import { ROUTES } from "../lib/constants";

type Decision = z.infer<typeof DecisionSchema> & {
  draftId?: string | null;
  lastConfirmedAt?: string | null;
};

export default function DecisionDetail() {
  const params = useParams();
  const decisionId = params.id as string;

  const { data: decisionResponse, isLoading, isError } = useDecisionsControllerGetDecision(decisionId);

  const parsed = DecisionSchema.passthrough().safeParse(decisionResponse);
  const decision = parsed.success ? (parsed.data as Decision) : undefined;

  if (isLoading) return <AppLayout><div className="p-8 text-center text-gray-500">Loading decision...</div></AppLayout>;
  if (isError || !decision) return <AppLayout><div className="p-8 text-center text-red-500">Error loading decision</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center gap-2 mb-6">
        <Link to="/decisions" className="text-blue-400 hover:text-blue-300">&larr; Back to Decisions</Link>
      </div>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">
            {decision.title || decision.content.title || 'Untitled Decision'}
          </h1>
          <StatusBadge status={decision.status} />
        </div>
        <div className="text-gray-400 text-sm flex flex-col items-end gap-1">
          <div>Created {decision.createdAt ? new Date(decision.createdAt).toLocaleDateString() : ''}</div>
          {decision.decidedBy && (
            <div>Decided by <span className="text-gray-300">{decision.decidedBy}</span></div>
          )}
        </div>
      </header>

      <div className="grid gap-6 mt-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>
            <div className="prose prose-invert max-w-none text-gray-300">
              <p className="whitespace-pre-wrap leading-relaxed">
                {decision.summary || decision.content.description || 'No summary provided.'}
              </p>
            </div>
          </section>

          {decision.supersededBy && (
             <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 border-dashed">
               <h3 className="text-sm font-medium text-gray-400 mb-2">Superseded By</h3>
               <Link to={`/decisions/${decision.supersededBy}`} className="text-blue-400 hover:underline flex items-center gap-2">
                 <span>View Superseding Decision</span>
                 <span>&rarr;</span>
               </Link>
             </div>
          )}

          {decision.draftId && (
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800 border-dashed">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Related Draft</h3>
              <Link to={`/drafts/${decision.draftId}`} className="text-blue-400 hover:underline flex items-center gap-2">
                <span>View Original Draft</span>
                <span>&rarr;</span>
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Impact Areas</h3>
            {decision.impactArea && decision.impactArea.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {decision.impactArea.map((area) => (
                  <span key={area} className="px-2.5 py-1 text-sm rounded-full bg-blue-900/30 text-blue-400 border border-blue-900/50">
                    {area}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">No impact areas specified</p>
            )}
          </section>

          {(decision.effectiveFrom || decision.effectiveTo) && (
            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Timeline</h3>
              <div className="space-y-3 text-sm">
                {decision.effectiveFrom && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Effective From</span>
                    <span className="text-gray-300">{new Date(decision.effectiveFrom).toLocaleDateString()}</span>
                  </div>
                )}
                {decision.effectiveTo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Effective To</span>
                    <span className="text-gray-300">{new Date(decision.effectiveTo).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {decision.sourceRefs && decision.sourceRefs.length > 0 && (
            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
              <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">References</h3>
              <ul className="space-y-2">
                {decision.sourceRefs.map((ref, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-gray-600 mt-1">&bull;</span>
                    <a 
                      href={ref.startsWith('http') ? ref : '#'} 
                      target={ref.startsWith('http') ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className={`break-all ${ref.startsWith('http') ? 'text-blue-400 hover:underline' : 'text-gray-300'}`}
                    >
                      {ref}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

            <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
            <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Metadata</h3>
            <div className="space-y-3 text-sm">
               <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="text-gray-500 font-mono text-xs truncate ml-2" title={decision.id}>{decision.id.substring(0, 8)}...</span>
              </div>
              {decision.createdBy && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Created By</span>
                  <span className="text-gray-300">{decision.createdBy}</span>
                </div>
              )}
              {decision.lastConfirmedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Confirmed</span>
                  <span className="text-gray-300">{new Date(decision.lastConfirmedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case 'active':
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-900/30 text-green-500 border border-green-900/50">
          Active
        </span>
      );
    case 'proposed':
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-900/30 text-yellow-500 border border-yellow-900/50">
          Proposed
        </span>
      );
    case 'revoked':
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-900/30 text-red-500 border border-red-900/50">
          Revoked
        </span>
      );
    default:
      return (
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-800 text-gray-400 border border-gray-700 line-through">
          Superseded
        </span>
      );
  }
}
