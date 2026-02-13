import { LlmService, LlmBudgetExceededError } from './llm.service';
import { z } from 'zod';

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue({
        raw: { usage_metadata: { input_tokens: 100, output_tokens: 50 } },
        parsed: { intent: 'decision', confidence: 0.9 },
      }),
    }),
  })),
}));

describe('LlmService', () => {
  let service: LlmService;
  const mockCostTracker = {
    getTotalCost: jest.fn().mockResolvedValue({ estimatedCostUsd: 0, totalTokens: 0, byModel: {} }),
    shouldDegrade: jest.fn().mockReturnValue({ degrade: false }),
    logUsage: jest.fn().mockResolvedValue(undefined),
  };
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = { OPENAI_MODEL: 'gpt-4o-mini' };
      return map[key];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    service = new LlmService(mockCostTracker as any, mockConfigService as any);
  });

  describe('budget check', () => {
    it('should throw LlmBudgetExceededError when budget exceeded', async () => {
      mockCostTracker.shouldDegrade.mockReturnValueOnce({
        degrade: true,
        reason: 'Budget exceeded',
      });

      const schema = z.object({ intent: z.string(), confidence: z.number() });

      await expect(
        service.structuredInvoke(schema, 'test system', 'test input'),
      ).rejects.toThrow(LlmBudgetExceededError);
    });

    it('should proceed when under budget', async () => {
      const schema = z.object({ intent: z.string(), confidence: z.number() });

      const result = await service.structuredInvoke(schema, 'test system', 'test input');
      expect(result).toEqual({ intent: 'decision', confidence: 0.9 });
    });
  });
});
