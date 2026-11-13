import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db";
import { apiPipelines } from "@/shared/db/api.pipeline";
import { redis } from "@/shared/redis";
import { calculateCostMicroUsd, usageQueue } from "@/modules/finops/queue";

const ingestBodySchema = z.object({
  model: z.string().min(1).max(64).default("gpt-4o"),
  inputTokens: z.number().int().min(0).max(10_000_000),
  outputTokens: z.number().int().min(0).max(10_000_000),
});

export async function POST(req: NextRequest) {
  // 1. Извлекаем Bearer-токен
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  const rawKey = authHeader.slice(7).trim();
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  // 2. Ищем пайплайн (с быстрым кэшем метаданных ключа в Redis на 30 сек)
  const metaCacheKey = `finops:key:${keyHash}`;
  let pipelineMeta: {
    id: string;
    userId: string;
    provider: string;
    environment: string;
    status: string;
    limitMicroUsd: number;
    currentMonthSpendMicroUsd: number;
  } | null = null;

  const cachedMeta = await redis.get(metaCacheKey);
  if (cachedMeta) {
    pipelineMeta = JSON.parse(cachedMeta);
  } else {
    const [found] = await db
      .select({
        id: apiPipelines.id,
        userId: apiPipelines.userId,
        provider: apiPipelines.provider,
        environment: apiPipelines.environment,
        status: apiPipelines.status,
        limitMicroUsd: apiPipelines.limitMicroUsd,
        currentMonthSpendMicroUsd: apiPipelines.currentMonthSpendMicroUsd,
      })
      .from(apiPipelines)
      .where(eq(apiPipelines.apiKeyHash, keyHash));

    if (found) {
      pipelineMeta = found;
      await redis.set(metaCacheKey, JSON.stringify(found), "EX", 30);
    }
  }

  if (!pipelineMeta) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // 3. Проверка Hard Cap (если уже заблокирован или превысил лимит)
  if (
    pipelineMeta.status === "Blocked" ||
    pipelineMeta.currentMonthSpendMicroUsd >= pipelineMeta.limitMicroUsd
  ) {
    return NextResponse.json(
      {
        error: "Hard budget limit exceeded",
        limitUsd: pipelineMeta.limitMicroUsd / 1_000_000,
      },
      { status: 429 },
    );
  }

  // 4. Валидируем тело запроса
  let body: z.infer<typeof ingestBodySchema>;
  try {
    const json = await req.json();
    body = ingestBodySchema.parse(json);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const costMicroUsd = calculateCostMicroUsd(
    pipelineMeta.provider,
    body.inputTokens,
    body.outputTokens,
  );

  // 5. Отправляем в BullMQ очередь и мгновенно отвечаем клиенту
  await usageQueue.add("record-usage", {
    pipelineId: pipelineMeta.id,
    userId: pipelineMeta.userId,
    environment: pipelineMeta.environment,
    provider: pipelineMeta.provider,
    model: body.model,
    inputTokens: body.inputTokens,
    outputTokens: body.outputTokens,
    costMicroUsd,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json(
    {
      accepted: true,
      estimatedCostUsd: Number((costMicroUsd / 1_000_000).toFixed(6)),
    },
    { status: 202 },
  );
}
