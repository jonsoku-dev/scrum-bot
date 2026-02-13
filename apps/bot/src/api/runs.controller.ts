import { Controller, Get, Inject, Param, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { eq, asc } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { AgentRunService } from '../drafts/agent-run.service.js';
import { DRIZZLE, type DrizzleDB } from '../shared/database/drizzle.provider.js';
import { agentMessages } from '../shared/database/schema.js';

@ApiTags('Runs')
@Controller('api/runs')
export class RunsController {
  constructor(
    private readonly agentRunService: AgentRunService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List agent runs' })
  @ApiResponse({ status: 200, description: 'List of agent runs' })
  async listRuns() {
    const runs = await this.agentRunService.getAllRuns();
    return { success: true, data: runs };
  }

  @Get(':runId')
  @ApiOperation({ summary: 'Get run by ID with related runs' })
  @ApiParam({ name: 'runId', description: 'Agent run ID' })
  @ApiResponse({ status: 200, description: 'Run details with related runs' })
  async getRun(@Param('runId') runId: string) {
    const run = await this.agentRunService.getRunById(runId);
    if (!run) {
      return { success: true, data: null };
    }

    const allRuns = run.draftId
      ? await this.agentRunService.getRunsByDraft(run.draftId)
      : [run];

    return {
      success: true,
      data: {
        run,
        relatedRuns: allRuns,
      },
    };
  }

  @Get(':runId/messages')
  @ApiOperation({ summary: 'Get agent messages for a run' })
  @ApiParam({ name: 'runId', description: 'Agent run ID' })
  @ApiResponse({ status: 200, description: 'List of agent messages for the run' })
  async getRunMessages(@Param('runId') runId: string) {
    const messages = await this.db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.runId, runId))
      .orderBy(asc(agentMessages.createdAt));

    return {
      success: true,
      data: messages,
      meta: { total: messages.length, runId },
    };
  }

  @SkipThrottle()
  @Get(':runId/stream')
  @ApiOperation({ summary: 'Stream run progress via SSE' })
  @ApiParam({ name: 'runId', description: 'Agent run ID' })
  @ApiResponse({ status: 200, description: 'Server-Sent Events stream' })
  async streamRun(
    @Param('runId') runId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const run = await this.agentRunService.getRunById(runId);
    if (!run) {
      res.write(`data: ${JSON.stringify({ error: 'Run not found' })}\n\n`);
      res.end();
      return;
    }

    const draftId = run.draftId;
    if (!draftId) {
      res.write(
        `data: ${JSON.stringify({ status: run.status, runs: [run] })}\n\n`,
      );
      res.end();
      return;
    }

    let closed = false;
    let iteration = 0;
    const MAX_ITERATIONS = 150; // 5 min at 2s interval

    req.on('close', () => {
      closed = true;
    });

    const poll = async () => {
      if (closed) return;
      if (iteration++ >= MAX_ITERATIONS) {
        res.write(`data: ${JSON.stringify({ status: 'timeout', message: 'Max polling iterations reached' })}\n\n`);
        res.end();
        return;
      }

      const runs = await this.agentRunService.getRunsByDraft(draftId);
      if (closed) return;
      res.write(`data: ${JSON.stringify({ status: 'polling', runs })}\n\n`);

      const allDone = runs.every(
        (r) => r.status === 'completed' || r.status === 'failed',
      );

      if (allDone && runs.length > 0) {
        res.write(`data: ${JSON.stringify({ status: 'done', runs })}\n\n`);
        res.end();
        return;
      }

      setTimeout(() => void poll(), 2000);
    };

    void poll();
  }
}
