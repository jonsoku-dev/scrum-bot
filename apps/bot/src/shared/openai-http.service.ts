import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';
import { AppException } from './exceptions/app.exception.js';

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

@Injectable()
export class OpenAiHttpService {
  private readonly logger = new Logger(OpenAiHttpService.name);
  private readonly client: AxiosInstance;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    const baseURL =
      this.configService.get<string>('OPENAI_BASE_URL') ??
      'https://api.openai.com/v1';
    this.embeddingModel =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
      'text-embedding-3-small';

    this.client = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  async embedText(text: string): Promise<number[]> {
    const { data } = await this.client.post<EmbeddingResponse>('/embeddings', {
      input: text,
      model: this.embeddingModel,
    });
    if (!data.data || data.data.length === 0) {
      throw new AppException('OpenAI embeddings API returned empty data array');
    }
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const { data } = await this.client.post<EmbeddingResponse>('/embeddings', {
      input: texts,
      model: this.embeddingModel,
    });
    return data.data.map((d) => d.embedding);
  }
}
