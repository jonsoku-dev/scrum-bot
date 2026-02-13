import { EvalService } from '../eval.service';
import { GOLDEN_SET, type GoldenSetCase } from './golden-set.fixture';

describe('Regression Eval — Golden Set', () => {
  let evalService: EvalService;

  const mockInsertValues = jest.fn().mockResolvedValue(undefined);
  const mockDb = {
    insert: jest.fn().mockReturnValue({ values: mockInsertValues }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    evalService = new EvalService(mockDb as never);
  });

  it('should have at least 3 golden set cases', () => {
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(3);
  });

  describe.each(GOLDEN_SET)('Case: $name (id=$id)', (goldenCase: GoldenSetCase) => {
    describe('evaluateSummary', () => {
      it('should score coverage ≥ 50 for a good summary', async () => {
        const summaryText = buildSummaryFromCase(goldenCase);
        const result = await evalService.evaluateSummary(
          `eval-${goldenCase.id}`,
          summaryText,
          goldenCase.inputText,
        );

        const coverageDim = result.dimensions.find((d) => d.name === 'coverage');
        expect(coverageDim).toBeDefined();
        expect(coverageDim!.score).toBeGreaterThanOrEqual(50);
      });

      it('should score conciseness within acceptable range', async () => {
        const summaryText = buildSummaryFromCase(goldenCase);
        const result = await evalService.evaluateSummary(
          `eval-${goldenCase.id}`,
          summaryText,
          goldenCase.inputText,
        );

        const conciseDim = result.dimensions.find((d) => d.name === 'conciseness');
        expect(conciseDim).toBeDefined();
        expect(conciseDim!.score).toBeGreaterThanOrEqual(40);
      });

      it('should return overall score ≥ 30', async () => {
        const summaryText = buildSummaryFromCase(goldenCase);
        const result = await evalService.evaluateSummary(
          `eval-${goldenCase.id}`,
          summaryText,
          goldenCase.inputText,
        );

        expect(result.overallScore).toBeGreaterThanOrEqual(30);
      });

      it('should persist evaluation to database', async () => {
        const summaryText = buildSummaryFromCase(goldenCase);
        await evalService.evaluateSummary(
          `eval-${goldenCase.id}`,
          summaryText,
          goldenCase.inputText,
        );

        expect(mockDb.insert).toHaveBeenCalled();
        expect(mockInsertValues).toHaveBeenCalledWith(
          expect.objectContaining({
            targetType: 'SUMMARY',
            targetId: `eval-${goldenCase.id}`,
            evaluatorType: 'AUTO',
          }),
        );
      });
    });

    describe('evaluateDraft', () => {
      it('should score completeness ≥ 50 for a well-formed draft', async () => {
        const draftRecord = buildDraftFromCase(goldenCase);
        const result = await evalService.evaluateDraft(
          `eval-draft-${goldenCase.id}`,
          draftRecord,
        );

        const completenessDim = result.dimensions.find((d) => d.name === 'completeness');
        expect(completenessDim).toBeDefined();
        expect(completenessDim!.score).toBeGreaterThanOrEqual(50);
      });

      it('should score acceptance criteria clarity ≥ 50 for detailed ACs', async () => {
        const draftRecord = buildDraftFromCase(goldenCase);
        const result = await evalService.evaluateDraft(
          `eval-draft-${goldenCase.id}`,
          draftRecord,
        );

        const acDim = result.dimensions.find((d) => d.name === 'ac_clarity');
        expect(acDim).toBeDefined();
        expect(acDim!.score).toBeGreaterThanOrEqual(50);
      });

      it('should score priority justification when priority is set', async () => {
        const draftRecord = buildDraftFromCase(goldenCase);
        const result = await evalService.evaluateDraft(
          `eval-draft-${goldenCase.id}`,
          draftRecord,
        );

        const priorityDim = result.dimensions.find((d) => d.name === 'priority_justified');
        expect(priorityDim).toBeDefined();
        expect(priorityDim!.score).toBeGreaterThanOrEqual(50);
      });

      it('should score source citations when citations are present', async () => {
        const draftRecord = buildDraftFromCase(goldenCase);
        const result = await evalService.evaluateDraft(
          `eval-draft-${goldenCase.id}`,
          draftRecord,
        );

        const citeDim = result.dimensions.find((d) => d.name === 'source_citations');
        expect(citeDim).toBeDefined();
        expect(citeDim!.score).toBeGreaterThanOrEqual(50);
      });

      it('should return overall score ≥ 50', async () => {
        const draftRecord = buildDraftFromCase(goldenCase);
        const result = await evalService.evaluateDraft(
          `eval-draft-${goldenCase.id}`,
          draftRecord,
        );

        expect(result.overallScore).toBeGreaterThanOrEqual(50);
      });
    });
  });

  describe('threshold regression guards', () => {
    it('should not regress: all golden cases must have summary coverage ≥ 0.5 (score ≥ 50)', async () => {
      for (const goldenCase of GOLDEN_SET) {
        const summaryText = buildSummaryFromCase(goldenCase);
        const result = await evalService.evaluateSummary(
          `threshold-${goldenCase.id}`,
          summaryText,
          goldenCase.inputText,
        );
        const coverageDim = result.dimensions.find((d) => d.name === 'coverage');
        expect(coverageDim!.score).toBeGreaterThanOrEqual(50);
      }
    });

    it('should not regress: all golden cases must have draft completeness ≥ 0.5 (score ≥ 50)', async () => {
      for (const goldenCase of GOLDEN_SET) {
        const draftRecord = buildDraftFromCase(goldenCase);
        const result = await evalService.evaluateDraft(
          `threshold-draft-${goldenCase.id}`,
          draftRecord,
        );
        const completenessDim = result.dimensions.find((d) => d.name === 'completeness');
        expect(completenessDim!.score).toBeGreaterThanOrEqual(50);
      }
    });
  });
});

function buildSummaryFromCase(goldenCase: GoldenSetCase): string {
  const keywords = goldenCase.expectedSummary.mustContainKeywords;
  const keyLines = goldenCase.inputText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 20)
    .filter((_, i) => i % 2 === 0)
    .slice(0, 10);

  const parts = [
    `Summary of ${goldenCase.name}:`,
    '',
    ...keyLines.map((l) => `- ${l}`),
    '',
    `Topics: ${keywords.join(', ')}.`,
    '',
    'Decisions:',
    `- Team decision on ${keywords[0]} [source: ref-1]`,
    '',
    'Action Items:',
    `- Investigate ${keywords[1] ?? keywords[0]} (should complete this sprint)`,
    `- Address ${keywords[2] ?? 'remaining'} questions`,
  ];
  return parts.join('\n');
}

function buildDraftFromCase(goldenCase: GoldenSetCase): Record<string, unknown> {
  return {
    content: {
      summary: goldenCase.expectedDraft.summary,
      descriptionMd: goldenCase.expectedDraft.descriptionMd,
      acceptanceCriteria: goldenCase.expectedDraft.acceptanceCriteria,
      priority: goldenCase.expectedDraft.priority,
      sourceCitations: goldenCase.expectedDraft.sourceCitations,
    },
  };
}
