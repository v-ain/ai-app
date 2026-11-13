import "dotenv/config";
import crypto from "node:crypto";
import { Worker } from "bullmq";
import { eq, sql } from "drizzle-orm";
import { db } from "./shared/db";
import { apiPipelines, dailyUsageMetrics } from "./shared/db/api.pipeline";
import { redis } from "./shared/redis";
import { FinOpsRepository } from "./modules/finops/repository";
import type { UsageIngestPayload } from "./modules/finops/queue";

console.log("🚀 Запуск FinOps BullMQ Worker...");

const worker = new Worker<UsageIngestPayload>(
  "finops-usage-queue",
  async (job) => {
    const data = job.data;
    const dateStr = data.timestamp.slice(0, 10);

    // 1. Атомарно обновляем или создаем дневной срез метрик (UPSERT)
    await db
      .insert(dailyUsageMetrics)
      .values({
        id: crypto.randomUUID(),
        pipelineId: data.pipelineId,
        date: dateStr,
        environment: data.environment,
        requestsCount: 1,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        costMicroUsd: data.costMicroUsd,
      })
      .onConflictDoUpdate({
        target: [dailyUsageMetrics.pipelineId, dailyUsageMetrics.date],
        set: {
          requestsCount: sql`${dailyUsageMetrics.requestsCount} + 1`,
          inputTokens: sql`${dailyUsageMetrics.inputTokens} + ${data.inputTokens}`,
          outputTokens: sql`${dailyUsageMetrics.outputTokens} + ${data.outputTokens}`,
          costMicroUsd: sql`${dailyUsageMetrics.costMicroUsd} + ${data.costMicroUsd}`,
        },
      });

    // 2. Увеличиваем общий расход пайплайна за месяц и получаем обновленную строку
    const [updated] = await db
      .update(apiPipelines)
      .set({
        currentMonthSpendMicroUsd: sql`${apiPipelines.currentMonthSpendMicroUsd} + ${data.costMicroUsd}`,
        updatedAt: new Date(),
      })
      .where(eq(apiPipelines.id, data.pipelineId))
      .returning();

    if (!updated) return;

    // 3. Проверяем пороги Target (Warning) и Hard Limit (Blocked)
    let nextStatus = updated.status;
    if (updated.currentMonthSpendMicroUsd >= updated.limitMicroUsd) {
      nextStatus = "Blocked";
    } else if (
      updated.currentMonthSpendMicroUsd >= updated.targetMicroUsd &&
      updated.status === "Active"
    ) {
      nextStatus = "Warning";
    }

    if (nextStatus !== updated.status) {
      await db
        .update(apiPipelines)
        .set({ status: nextStatus })
        .where(eq(apiPipelines.id, data.pipelineId));

      // Сбрасываем кэш ключа в Redis, чтобы шлюз мгновенно заблокировал следующие запросы
      await redis.del(`finops:key:${updated.apiKeyHash}`);
    }

    // 4. Инвалидируем кэш дашборда пользователя
    await FinOpsRepository.invalidateUserCache(data.userId);
  },
  {
    connection: redis,
    concurrency: 10,
  },
);

worker.on("completed", (job) => {
  console.log(
    `✅ Задача ${job.id} обработана (pipeline: ${job.data.pipelineId})`,
  );
});

worker.on("failed", (job, err) => {
  console.error(`❌ Ошибка в задаче ${job?.id}:`, err.message);
});

// Graceful shutdown для Docker контейнеров
process.on("SIGTERM", async () => {
  console.log("🛑 Завершение работы воркера...");
  await worker.close();
  process.exit(0);
});
