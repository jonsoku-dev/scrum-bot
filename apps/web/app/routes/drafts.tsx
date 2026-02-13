import { Link, useSearchParams } from "react-router";
import { useDraftsControllerListDrafts } from "../lib/api/drafts/drafts";
import { DraftSchema } from "../lib/schemas";
import { z } from "zod";
import { AppLayout } from "../components/app-layout";
import { StatusBadge } from "../components/ui/status-badge";
import { TypeBadge } from "../components/ui/type-badge";
import { PageHeader } from "../components/ui/page-header";
import { EmptyState, LoadingState } from "../components/ui/states";

export default function Drafts() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const currentType = searchParams.get("type") || "all";

  const { data: draftsResponse, isLoading } = useDraftsControllerListDrafts({
    status: currentStatus !== 'all' ? currentStatus : undefined,
    type: currentType !== 'all' ? currentType : undefined
  });

  // Safe parsing using Zod
  const drafts = z.array(DraftSchema).safeParse(draftsResponse?.data).data || [];

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParams = new URLSearchParams(searchParams);
    if (e.target.value === 'all') {
      newParams.delete("status");
    } else {
      newParams.set("status", e.target.value);
    }
    setSearchParams(newParams);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParams = new URLSearchParams(searchParams);
    if (e.target.value === 'all') {
      newParams.delete("type");
    } else {
      newParams.set("type", e.target.value);
    }
    setSearchParams(newParams);
  };

  return (
    <AppLayout>
        <PageHeader 
          title="Drafts" 
          description="Manage generated tickets and artifacts"
        >
          <div className="flex gap-4">
            <select
              value={currentStatus}
              onChange={handleStatusChange}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="executed">Executed</option>
            </select>

            <select
              value={currentType}
              onChange={handleTypeChange}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
            >
              <option value="all">All Types</option>
              <option value="jira_ticket">Jira Ticket</option>
              <option value="decision">Decision</option>
              <option value="action_item">Action Item</option>
            </select>
          </div>
        </PageHeader>

        <section>
          {isLoading ? (
             <LoadingState message="Loading drafts..." />
          ) : drafts.length === 0 ? (
            <EmptyState message="No drafts found matching filters." />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {drafts.map((draft) => (
                <Link 
                  key={draft.id} 
                  to={`/drafts/${draft.id}`}
                  className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors flex flex-col block"
                >
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <TypeBadge type={draft.type} />
                      <StatusBadge status={draft.status} />
                    </div>
                    
                    <p className="text-gray-300 line-clamp-3 mb-4 text-sm leading-relaxed">
                      {draft.content.summary}
                    </p>
                  </div>
                  
                  <div className="bg-gray-950/30 px-5 py-3 border-t border-gray-800 text-xs text-gray-500">
                    Created {draft.createdAt ? new Date(draft.createdAt).toLocaleDateString() : ''}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
    </AppLayout>
  );
}
