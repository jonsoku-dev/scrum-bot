import { Link, useParams } from "react-router";
import { useRunsControllerGetRun } from "../lib/api/runs/runs";
import { useRunStream } from "../lib/hooks/useRunStream";
import { RunTimelineSchema } from "../lib/schemas";
import { z } from "zod";
import { useState, useMemo } from "react";
import { ROUTES } from "../lib/constants";
import { AppLayout } from "../components/app-layout";
import { PageHeader } from "../components/ui/page-header";
import { LoadingState, ErrorState } from "../components/ui/states";

export default function RunTimeline() {
  const params = useParams();
  const runId = params.runId as string;

  const { data: runResponse, isLoading, isError } = useRunsControllerGetRun(runId);

  const parsed = RunTimelineSchema.safeParse(runResponse);
  const runData = parsed.success ? parsed.data : null;
  const runs = runData?.relatedRuns && runData.relatedRuns.length > 0
    ? runData.relatedRuns
    : (runData?.run ? [runData.run] : []);

  useRunStream(runId);

  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    }),
    [runs],
  );

  const completedCount = sortedRuns.filter(r => r.status === 'completed').length;
  const failedCount = sortedRuns.filter(r => r.status === 'failed').length;
  const runningCount = sortedRuns.filter(r => r.status === 'running').length;
  const progress = sortedRuns.length > 0 ? (completedCount / sortedRuns.length) * 100 : 0;

  const totalTokens = sortedRuns.reduce((sum, r) => sum + (r.tokenUsage?.total ?? 0), 0);
  const totalDurationMs = sortedRuns.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

  if (isLoading) return <LoadingState message="Loading timeline..." />;
  if (isError || !runData) return <ErrorState message="Error loading timeline" />;

  return (
    <AppLayout>
        <div className="flex items-center gap-2 mb-6">
             <Link to={ROUTES.DRAFTS} className="text-blue-400 hover:text-blue-300">&larr; Back to Drafts</Link>
        </div>

        <PageHeader 
          title="Agent Execution Timeline" 
          description="Real-time trace of agent activities"
        >
          {/* We can't put the stats inside PageHeader children because they are below description in original design.
              But the original design had them below title/description. 
              Let's put them below the PageHeader component for now, or use the description prop cleverly.
              Since PageHeader puts description below title, and we updated it to accept ReactNode, we can put everything there?
              No, PageHeader layout is: Left(Title, Desc) Right(Children).
              The original layout was: Header(Title, Desc, StatsGrid, Progress).
              This is a very custom header. 
              Maybe I should NOT use PageHeader here if it changes layout too much?
              Or I can put the StatsGrid and Progress *after* the PageHeader.
              Let's put them after. It's semantically a dashboard-like view.
          */}
        </PageHeader>
        
        {/* Reconstruct the parts that were in the header but don't fit PageHeader strict layout */}
        <div className="mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <StatCard label="Progress" value={`${Math.round(progress)}%`} />
                <StatCard label="Total Tokens" value={totalTokens.toLocaleString()} />
                <StatCard label="Duration" value={`${(totalDurationMs / 1000).toFixed(1)}s`} />
                <StatCard
                label="Status"
                value={runningCount > 0 ? `${runningCount} running` : failedCount > 0 ? `${failedCount} failed` : 'Done'}
                color={runningCount > 0 ? 'text-blue-400' : failedCount > 0 ? 'text-red-400' : 'text-green-400'}
                />
            </div>
            
            <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{completedCount}/{sortedRuns.length} steps</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden">
                    <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${failedCount > 0 ? 'bg-red-600' : 'bg-blue-600'}`}
                    style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>

        <div className="relative border-l-2 border-gray-800 ml-4 space-y-8 pl-8 py-4">
            {sortedRuns.map((run) => (
                <TimelineNode key={run.id} run={run} />
            ))}
        </div>
    </AppLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${color ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

type AgentRunParsed = z.infer<typeof import("../lib/schemas").AgentRunSchema>;

function TimelineNode({ run }: { run: AgentRunParsed }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="relative">
            <div className={`absolute -left-[41px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-gray-950 ${getStatusColor(run.status)}`}>
                {getStatusIcon(run.status)}
            </div>
            
            <div className={`bg-gray-900 rounded-xl border ${getStatusBorder(run.status)} p-5 transition-all`}>
                <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            {formatAgentName(run.agentName || 'Unknown Agent')}
                        </h3>
                        <div className="text-xs text-gray-500 mt-1">
                            Started {run.createdAt ? new Date(run.createdAt).toLocaleTimeString() : ''}
                            {run.durationMs && ` • ${run.durationMs}ms`}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {run.tokenUsage && (
                            <div className="text-xs text-gray-500 bg-gray-950 px-2 py-1 rounded border border-gray-800">
                                {run.tokenUsage.total} tokens
                            </div>
                        )}
                        <span className="text-gray-500 transform transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            &#x25bc;
                        </span>
                    </div>
                </div>

                {run.error && (
                    <div className="mt-3 bg-red-900/20 border border-red-900/40 text-red-400 p-3 rounded text-sm font-mono whitespace-pre-wrap">
                        {run.error}
                    </div>
                )}

                {expanded && (
                    <div className="mt-4 pt-4 border-t border-gray-800 space-y-4 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                        {run.input ? (
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Input</div>
                                <div className="bg-gray-950 p-3 rounded border border-gray-800 overflow-x-auto">
                                    <pre className="text-gray-300 font-mono text-xs">{JSON.stringify(run.input, null, 2)}</pre>
                                </div>
                            </div>
                        ) : null}
                        {run.output ? (
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Output</div>
                                <div className="bg-gray-950 p-3 rounded border border-gray-800 overflow-x-auto">
                                    <pre className="text-green-300 font-mono text-xs">{JSON.stringify(run.output, null, 2)}</pre>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

function getStatusColor(status?: string) {
    switch (status) {
        case 'pending': return 'border-gray-700 text-gray-500';
        case 'running': return 'border-blue-500 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
        case 'completed': return 'border-green-500 text-green-500';
        case 'failed': return 'border-red-500 text-red-500';
        default: return 'border-gray-700';
    }
}

function getStatusBorder(status?: string) {
     switch (status) {
        case 'running': return 'border-blue-500/50';
        case 'failed': return 'border-red-900/50';
        default: return 'border-gray-800';
    }
}

function getStatusIcon(status?: string) {
    switch (status) {
        case 'pending': return '⏳';
        case 'running': return <span className="animate-spin">🔄</span>;
        case 'completed': return '✅';
        case 'failed': return '❌';
        default: return '•';
    }
}

function formatAgentName(name: string) {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
