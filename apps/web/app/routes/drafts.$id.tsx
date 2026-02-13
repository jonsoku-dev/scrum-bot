import { Link, useNavigate, useParams } from "react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDraftsControllerGetDraft,
  useDraftsControllerUpdateDraft,
  useDraftsControllerApproveDraft,
  useDraftsControllerRejectDraft
} from "../lib/api/drafts/drafts";
import { DraftSchema, DraftContentSchema } from "../lib/schemas";
import { z } from "zod";
import { ROUTES } from "../lib/constants";
import { AppLayout } from "../components/app-layout";
import { StatusBadge } from "../components/ui/status-badge";
import { TypeBadge } from "../components/ui/type-badge";
import { LoadingState, ErrorState } from "../components/ui/states";
import { sanitizeInput } from "../lib/sanitize";

type Draft = z.infer<typeof DraftSchema>;

// Sub-component to handle form state initialization without useEffect
function DraftEditForm({ draft, onSubmit, isSubmitting, isPending }: { 
  draft: Draft; 
  onSubmit: (data: { summary: string, descriptionMd: string }) => void;
  isSubmitting: boolean;
  isPending: boolean;
}) {
  const [summary, setSummary] = useState(draft.content?.summary || "");
  const [description, setDescription] = useState(draft.content?.descriptionMd || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ summary: sanitizeInput(summary), descriptionMd: sanitizeInput(description) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-400">Summary</label>
        {isPending ? (
          <textarea
            name="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[80px]"
            required
          />
        ) : (
          <p className="text-xl font-semibold text-white">{draft.content?.summary}</p>
        )}
      </div>

      {draft.content?.descriptionMd !== undefined && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-400">Description (Markdown)</label>
          {isPending ? (
            <textarea
              name="descriptionMd"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[200px] font-mono text-sm"
            />
          ) : (
            <div className="prose prose-invert max-w-none bg-gray-950/50 p-4 rounded-lg border border-gray-800">
              <pre className="whitespace-pre-wrap font-sans">{draft.content?.descriptionMd}</pre>
            </div>
          )}
        </div>
      )}

      {isPending && (
        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </form>
  );
}

export default function DraftDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draftId = params.id as string;
  
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const { data: draftResponse, isLoading, isError } = useDraftsControllerGetDraft(draftId);

  const parsed = DraftSchema.safeParse(draftResponse);
  const draft: Draft | undefined = parsed.success ? parsed.data : undefined;

  const updateMutation = useDraftsControllerUpdateDraft({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/drafts/${draftId}`] });
        setActionMessage({ type: 'success', text: "Draft updated successfully" });
      },
      onError: () => {
        setActionMessage({ type: 'error', text: "Failed to update draft" });
      }
    }
  });

  const approveMutation = useDraftsControllerApproveDraft({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/drafts/${draftId}`] });
        navigate(ROUTES.DRAFTS);
      },
      onError: () => {
        setActionMessage({ type: 'error', text: "Failed to approve draft" });
      }
    }
  });

  const rejectMutation = useDraftsControllerRejectDraft({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/drafts/${draftId}`] });
        navigate(ROUTES.DRAFTS);
      },
      onError: () => {
        setActionMessage({ type: 'error', text: "Failed to reject draft" });
      }
    }
  });

  const handleUpdate = (data: { summary: string, descriptionMd: string }) => {
    updateMutation.mutate({ 
      id: draftId,
      data: { content: data },
    });
  };

  const isSubmitting = updateMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  if (isLoading) return <LoadingState message="Loading draft..." />;
  if (isError || !draft) return <ErrorState message="Error loading draft" />;

  const isPending = draft.status === 'pending';

  return (
    <AppLayout>
        <div className="flex items-center gap-2 mb-6">
            <Link to={ROUTES.DRAFTS} className="text-blue-400 hover:text-blue-300">&larr; Back to Drafts</Link>
        </div>

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div className="flex items-center gap-4">
            <TypeBadge type={draft.type} />
            <StatusBadge status={draft.status} />
          </div>
          <div className="text-gray-400 text-sm">
            Created {draft.createdAt ? new Date(draft.createdAt).toLocaleString() : ''}
          </div>
        </header>

        {actionMessage && (
            <div className={`p-4 rounded-lg border ${
                actionMessage.type === 'success' 
                ? 'bg-green-900/30 border-green-900/50 text-green-500' 
                : 'bg-red-900/30 border-red-900/50 text-red-500'
            }`}>
                {actionMessage.text}
            </div>
        )}

        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 shadow-lg space-y-8">
            <DraftEditForm 
              draft={draft} 
              onSubmit={handleUpdate}
              isSubmitting={isSubmitting}
              isPending={isPending}
            />

            {draft.updatedAt !== draft.createdAt && (
                <div className="bg-gray-950/30 rounded-xl p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium text-gray-400">Change History</h3>
                        <span className="text-xs text-gray-500">Last modified: {new Date(draft.updatedAt).toLocaleString()}</span>
                    </div>
                    {(() => {
                        const prev = DraftContentSchema.safeParse(draft.metadata?.previousContent);
                        if (!prev.success) {
                            return <p className="text-sm text-gray-500 italic">Modified from original AI draft</p>;
                        }
                        return (
                            <div className="mt-2 space-y-2 text-sm">
                                {prev.data.summary !== draft.content?.summary && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-red-900/10 p-2 rounded border border-red-900/20">
                                            <div className="text-xs text-red-400 mb-1">Previous Summary</div>
                                            <p className="text-red-300/80 line-through">{prev.data.summary}</p>
                                        </div>
                                        <div className="bg-green-900/10 p-2 rounded border border-green-900/20">
                                            <div className="text-xs text-green-400 mb-1">Current Summary</div>
                                            <p className="text-green-300">{draft.content?.summary}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {draft.content?.acceptanceCriteria && draft.content.acceptanceCriteria.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-medium text-white">Acceptance Criteria</h3>
                    <ul className="space-y-2">
                        {draft.content.acceptanceCriteria.map((criteria, idx) => (
                            <li key={idx} className="flex items-start gap-3 bg-gray-950/30 p-3 rounded-lg border border-gray-800/50">
                                <span className="text-blue-500 mt-1">&bull;</span>
                                <span className="text-gray-300">{criteria}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-800">
                {draft.content?.priority && (
                    <div className="bg-gray-950 px-3 py-1 rounded border border-gray-800 text-sm">
                        <span className="text-gray-500 mr-2">Priority:</span>
                        <span className="text-white font-medium">{draft.content.priority}</span>
                    </div>
                )}
                {draft.content?.issueType && (
                    <div className="bg-gray-950 px-3 py-1 rounded border border-gray-800 text-sm">
                        <span className="text-gray-500 mr-2">Type:</span>
                        <span className="text-white font-medium">{draft.content.issueType}</span>
                    </div>
                )}
                {draft.content?.projectKey && (
                    <div className="bg-gray-950 px-3 py-1 rounded border border-gray-800 text-sm">
                        <span className="text-gray-500 mr-2">Project:</span>
                        <span className="text-white font-medium">{draft.content.projectKey}</span>
                    </div>
                )}
            </div>

             {draft.content?.labels && draft.content.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {draft.content.labels.map(label => (
                        <span key={label} className="px-2 py-1 rounded-full bg-blue-900/20 text-blue-400 text-xs border border-blue-900/30">
                            {label}
                        </span>
                    ))}
                </div>
            )}
        </div>

        {draft.content?.sourceCitations && draft.content.sourceCitations.length > 0 && (
            <section className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">Source Context</h3>
                    <div className="flex gap-2">
                        <span className="bg-gray-950 text-gray-400 px-2 py-1 rounded text-xs border border-gray-800">
                            Sources: {draft.content.sourceCitations.length}
                        </span>
                        {(draft.content?.confidence !== undefined || draft.metadata?.confidence !== undefined) && (
                            <span className={`px-2 py-1 rounded text-xs border ${
                                ((draft.content?.confidence ?? draft.metadata?.confidence ?? 0) > 0.8) 
                                ? 'bg-green-900/20 text-green-400 border-green-900/30' 
                                : 'bg-yellow-900/20 text-yellow-400 border-yellow-900/30'
                            }`}>
                                Confidence: {Math.round((draft.content?.confidence ?? draft.metadata?.confidence ?? 0) * 100)}%
                            </span>
                        )}
                        {(draft.content?.confidence === undefined && draft.metadata?.confidence === undefined) && (
                             <span className="bg-gray-950 text-gray-500 px-2 py-1 rounded text-xs border border-gray-800">
                                Confidence: N/A
                            </span>
                        )}
                    </div>
                </div>
                <div className="space-y-3">
                    {draft.content.sourceCitations.map((source, idx) => (
                        <a 
                            key={idx} 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block p-3 bg-gray-950 rounded border border-gray-800 hover:border-blue-500/50 transition-colors group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-gray-500 uppercase">{source.type}</span>
                                    <span className="text-gray-300 group-hover:text-blue-400 transition-colors">{source.id}</span>
                                </div>
                                <span className="text-gray-600 group-hover:text-gray-400">&nearr;</span>
                            </div>
                        </a>
                    ))}
                </div>
            </section>
        )}

        {isPending && (
            <div className="flex gap-4 justify-end pt-4 border-t border-gray-800">
                <div className="flex gap-4">
                    <button
                        onClick={() => rejectMutation.mutate({ id: draftId })}
                        disabled={isSubmitting}
                        className="px-6 py-2 rounded-lg font-medium text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                        Reject
                    </button>
                    <div className="flex items-center gap-3">
                        {(!draft.content?.sourceCitations || draft.content.sourceCitations.length === 0) && (
                             <span className="text-sm text-gray-500 font-medium">(0 sources)</span>
                        )}
                        <button
                            onClick={() => approveMutation.mutate({ id: draftId })}
                            disabled={isSubmitting || !draft.content?.sourceCitations || draft.content.sourceCitations.length === 0}
                            title={(!draft.content?.sourceCitations || draft.content.sourceCitations.length === 0) ? "No source citations available" : undefined}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Approve Draft
                        </button>
                    </div>
                </div>
            </div>
        )}
    </AppLayout>
  );
}
