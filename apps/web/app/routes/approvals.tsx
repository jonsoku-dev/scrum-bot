import { Link, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  useDraftsControllerListDrafts,
  useDraftsControllerApproveDraft,
  useDraftsControllerRejectDraft
} from "../lib/api/drafts/drafts";
import { DraftSchema } from "../lib/schemas";
import { z } from "zod";
import { AppLayout } from "../components/app-layout";
import { TypeBadge } from "../components/ui/type-badge";
import { PageHeader } from "../components/ui/page-header";
import { LoadingState, EmptyState } from "../components/ui/states";
import { Pagination } from "../components/ui/pagination";

export default function Approvals() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const currentPage = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;

  const { data: draftsResponse, isLoading } = useDraftsControllerListDrafts({
    status: 'pending',
    page: currentPage,
    limit: limit,
  });

  const drafts = z.array(DraftSchema).safeParse(draftsResponse?.data).data || [];
  // @ts-ignore - API response might not be typed correctly yet
  const meta = draftsResponse?.meta || { total: 0, page: 1, limit: 20 };
  const totalPages = Math.ceil((meta.total || 0) / limit);

  const approveMutation = useDraftsControllerApproveDraft({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/drafts'] });
        setActionMessage({ type: 'success', text: "Draft approved" });
      },
      onError: () => {
        setActionMessage({ type: 'error', text: "Failed to approve draft" });
      }
    }
  });

  const rejectMutation = useDraftsControllerRejectDraft({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/drafts'] });
        setActionMessage({ type: 'success', text: "Draft rejected" });
      },
      onError: () => {
        setActionMessage({ type: 'error', text: "Failed to reject draft" });
      }
    }
  });

  const handleApprove = (draftId: string) => {
    approveMutation.mutate({ id: draftId });
  };

  const handleReject = (draftId: string) => {
    rejectMutation.mutate({ id: draftId });
  };

  const isSubmitting = approveMutation.isPending || rejectMutation.isPending;

  return (
    <AppLayout>
        <PageHeader 
          title="Pending Approvals" 
          description="Review and authorize pending items"
        >
          <div className="bg-blue-900/30 text-blue-400 px-4 py-2 rounded-full border border-blue-900/50 font-medium">
            {drafts.length} Pending
          </div>
        </PageHeader>

        {actionMessage && (
            <div className={`p-4 rounded-lg border ${
                actionMessage.type === 'success' 
                ? 'bg-green-900/30 border-green-900/50 text-green-500' 
                : 'bg-red-900/30 border-red-900/50 text-red-500'
            }`}>
                {actionMessage.text}
            </div>
        )}

        <section>
          {isLoading ? (
             <LoadingState message="Loading pending approvals..." />
          ) : drafts.length === 0 ? (
            <EmptyState message="No pending approvals." />
          ) : (
            <>
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <div  
                  key={draft.id} 
                  className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center hover:border-gray-700 transition-colors"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <TypeBadge type={draft.type} />
                      <span className="text-sm text-gray-500">
                        {draft.createdAt ? new Date(draft.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-medium text-white">
                        <Link to={`/drafts/${draft.id}`} className="hover:text-blue-400 transition-colors">
                            {draft.content.summary}
                        </Link>
                    </h3>
                    
                    {draft.content.sourceCitations && draft.content.sourceCitations.length > 0 && (
                        <div className="flex gap-2 text-xs text-gray-500">
                            <span>Sources:</span>
                            {draft.content.sourceCitations.map((source, idx) => (
                                <a 
                                    key={idx} 
                                    href={source.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-400 transition-colors"
                                >
                                    {source.id}
                                </a>
                            ))}
                        </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={() => handleReject(draft.id ?? '')}
                            disabled={isSubmitting}
                            className="flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors disabled:opacity-50 border border-transparent hover:border-red-900/30"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => handleApprove(draft.id ?? '')}
                            disabled={isSubmitting}
                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-green-900/20 disabled:opacity-50"
                        >
                            Approve
                        </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              
              <Pagination totalPages={totalPages} />
            </>
          )}
        </section>
    </AppLayout>
  );
}
