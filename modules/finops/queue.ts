import { Queue } from "bullmq";
import { redis } from "@/shared/redis";

export interface UsageIngestPayload {
  pipelineId: string;
  userId: string;
  environment: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  timestamp: string;
}

// Прайс-лист моделей (микродолларов за 1000 токенов)
export function calculateCostMicroUsd(
  provider: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates: Record<string, { in: number; out: number }> = {
    OpenAI: { in: 2500, out: 10000 }, // $2.50 / $10.00 за 1M токенов
    Anthropic: { in: 3000, out: 15000 }, // $3.00 / $15.00 за 1M токенов
    DeepSeek: { in: 270, out: 1100 }, // $0.27 / $1.10 за 1M токенов
    "Custom API": { in: 1000, out: 2000 },
  };

  const rate = rates[provider] ?? rates["Custom API"];
  const inputCost = (inputTokens / 1000) * rate.in;
  const outputCost = (outputTokens / 1000) * rate.out;

  return Math.max(1, Math.round(inputCost + outputCost));
}

export const usageQueue = new Queue<UsageIngestPayload>("finops-usage-queue", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
