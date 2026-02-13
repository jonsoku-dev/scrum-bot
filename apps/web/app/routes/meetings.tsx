import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AppLayout } from "../components/app-layout";
import { AXIOS_INSTANCE } from "../lib/api/axios";
import { QUERY_KEYS } from "../lib/constants";
import { LoadingState, EmptyState } from "../components/ui/states";
import { StatusBadge } from "../components/ui/status-badge";
import { sanitizeInput } from "../lib/sanitize";
import { Pagination } from "../components/ui/pagination";
import { PageHeader } from "../components/ui/page-header";

const MeetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  rawText: z.string(),
  source: z.string(),
  status: z.string(),
  summaryId: z.string().nullable().optional(),
  draftIds: z.array(z.string()).nullable().optional(),
  uploadedBy: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

type Meeting = z.infer<typeof MeetingSchema>;

const UploadResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    meetingId: z.string(),
    summaryId: z.string(),
    draftIds: z.array(z.string()),
    summary: z.string(),
  }),
});

function fetchMeetings(page: number, limit: number): Promise<{ data: Meeting[], meta: any }> {
  return AXIOS_INSTANCE.get("/api/meetings", { params: { page, limit } }).then((res) => {
    const parsed = z.array(MeetingSchema).safeParse(res.data?.data);
    return {
      data: parsed.success ? parsed.data : [],
      meta: res.data?.meta
    };
  });
}

function uploadMeeting(body: { title: string; text: string; uploadedBy?: string }) {
  return AXIOS_INSTANCE.post("/api/meetings/upload", body).then((res) => {
    const parsed = UploadResponseSchema.safeParse(res.data);
    if (!parsed.success) throw new Error("Invalid response");
    return parsed.data;
  });
}

export default function Meetings() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<z.infer<typeof UploadResponseSchema> | null>(null);

  const currentPage = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.MEETINGS, currentPage, limit],
    queryFn: () => fetchMeetings(currentPage, limit),
  });

  const meetings = data?.data || [];
  // @ts-ignore - API response might not be typed correctly yet
  const meta = data?.meta || { total: 0, page: 1, limit: 20 };
  const totalPages = Math.ceil((meta.total || 0) / limit);

  const mutation = useMutation({
    mutationFn: uploadMeeting,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEETINGS] });
      setTitle("");
      setText("");
      setLastResult(data);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || text.trim().length <= 10) return;
    mutation.mutate({ title: sanitizeInput(title), text: sanitizeInput(text) });
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Meeting Minutes" 
        description="Upload meeting notes to extract action items and generate drafts" 
      />

      <section className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-white">Upload Meeting Minutes</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="meeting-title" className="block text-sm font-medium text-gray-400 mb-1">
              Meeting Title
            </label>
            <input
              type="text"
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sprint 12 Daily Standup"
              required
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div>
            <label htmlFor="meeting-text" className="block text-sm font-medium text-gray-400 mb-1">
              Meeting Notes
            </label>
            <textarea
              id="meeting-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full meeting minutes text here..."
              required
              rows={8}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-y"
            />
            <p className="text-xs text-gray-500 mt-1">
              {text.length} characters (minimum 11)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={mutation.isPending || !title.trim() || text.trim().length <= 10}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <span className="animate-spin">⟳</span> Processing...
                </>
              ) : (
                "Upload & Process"
              )}
            </button>
            {mutation.isError && (
              <p className="text-red-400 text-sm">Failed to process meeting minutes.</p>
            )}
          </div>
        </form>
      </section>

      {lastResult && (
        <section className="bg-green-900/20 rounded-xl p-6 border border-green-800/50">
          <h3 className="text-lg font-semibold text-green-400 mb-2">Processing Complete</h3>
          <p className="text-gray-300 text-sm mb-3">{lastResult.data.summary}</p>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-400">
              {lastResult.data.draftIds.length} draft(s) created
            </span>
            {lastResult.data.draftIds.length > 0 && (
              <Link to="/drafts" className="text-blue-400 hover:text-blue-300 underline">
                View Drafts →
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          Meeting History
          <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full">
            {meetings.length}
          </span>
        </h2>

        {isLoading ? (
          <LoadingState message="Loading meetings..." />
        ) : meetings.length === 0 ? (
          <EmptyState message="No meetings uploaded yet" />
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {meetings.map((meeting) => (
                <article
                  key={meeting.id}
                  className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors flex flex-col cursor-pointer"
                  onClick={() => setExpandedId(expandedId === meeting.id ? null : meeting.id)}
                >
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-white font-medium text-sm line-clamp-2 flex-1 mr-2">
                        {meeting.title}
                      </h3>
                      <StatusBadge status={meeting.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-950/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Source</div>
                        <div className="text-sm font-medium text-white">{meeting.source}</div>
                      </div>
                      <div className="bg-gray-950/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Drafts</div>
                        <div className="text-sm font-medium text-white">
                          {meeting.draftIds?.length ?? 0}
                        </div>
                      </div>
                    </div>

                    {expandedId === meeting.id && (
                      <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
                        <p className="text-gray-400 text-xs line-clamp-4">
                          {meeting.rawText}
                        </p>
                        {meeting.draftIds && meeting.draftIds.length > 0 && (
                          <Link
                            to="/drafts"
                            className="text-blue-400 hover:text-blue-300 text-xs underline inline-block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View generated drafts →
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-950/30 px-5 py-3 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
                    <span>
                      {meeting.createdAt
                        ? new Date(meeting.createdAt).toLocaleDateString()
                        : ""}
                    </span>
                    {meeting.uploadedBy && <span>by {meeting.uploadedBy}</span>}
                  </div>
                </article>
              ))}
            </div>
            <Pagination totalPages={totalPages} className="mt-8" />
          </>
        )}
      </section>
    </AppLayout>
  );
}
