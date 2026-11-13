import "dotenv/config";
import crypto from "node:crypto";
import { db } from "./index";
import { user } from "./schema";
import { apiPipelines, dailyUsageMetrics } from "./api.pipeline";

const USD = 1_000_000;

const INITIAL_PIPELINES = [
  {
    name: "Customer Support Agent",
    provider: "OpenAI",
    environment: "production",
    status: "Active",
    target: 450 * USD,
    limit: 600 * USD,
    ownerName: "Alex Mercer",
  },
  {
    name: "Code Review Pipeline",
    provider: "Anthropic",
    environment: "production",
    status: "Warning",
    target: 300 * USD,
    limit: 350 * USD,
    ownerName: "Elena Rostova",
  },
  {
    name: "RAG Knowledge Indexer",
    provider: "DeepSeek",
    environment: "production",
    status: "Active",
    target: 120 * USD,
    limit: 200 * USD,
    ownerName: "Marcus Vance",
  },
  {
    name: "SQL Analytics Copilot",
    provider: "OpenAI",
    environment: "production",
    status: "Blocked",
    target: 200 * USD,
    limit: 250 * USD,
    ownerName: "Elena Rostova",
  },
  {
    name: "Staging E2E Eval Runner",
    provider: "Anthropic",
    environment: "staging",
    status: "Active",
    target: 80 * USD,
    limit: 150 * USD,
    ownerName: "Alex Mercer",
  },
  {
    name: "Voice Transcription Worker",
    provider: "Custom API",
    environment: "production",
    status: "Active",
    target: 180 * USD,
    limit: 250 * USD,
    ownerName: "Dmitry Volkov",
  },
  {
    name: "Dev Sandbox Playground",
    provider: "DeepSeek",
    environment: "staging",
    status: "Active",
    target: 50 * USD,
    limit: 100 * USD,
    ownerName: "Dmitry Volkov",
  },
];

async function seed() {
  console.log("🌱 Запуск генерации данных FinOps...");

  const existingUsers = await db.select().from(user).limit(1);
  if (existingUsers.length === 0) {
    console.error(
      "❌ В базе нет ни одного пользователя. Сначала зарегистрируйся через /login!",
    );
    process.exit(1);
  }

  const currentUser = existingUsers[0];
  console.log(
    `👤 Наполняем данные для пользователя: ${currentUser.name} (${currentUser.email})`,
  );

  const today = new Date();
  const currentMonthPrefix = today.toISOString().slice(0, 7); // "YYYY-MM"

  for (let idx = 0; idx < INITIAL_PIPELINES.length; idx++) {
    const item = INITIAL_PIPELINES[idx];
    const pipelineId = `pipe_${idx + 1}_${crypto.randomBytes(4).toString("hex")}`;
    const rawKey = `sk-fin-${crypto.randomBytes(16).toString("hex")}`;
    const apiKeyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    let currentMonthSpend = 0;
    const metricsBatch: (typeof dailyUsageMetrics.$inferInsert)[] = [];

    // Генерируем 90 дней истории
    for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - dayOffset);
      const dateStr = d.toISOString().slice(0, 10);

      // Имитируем органический рост и спад в выходные
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const baseRequests = item.environment === "production" ? 1400 : 450;
      const multiplier =
        (isWeekend ? 0.55 : 1.1) * (0.75 + Math.random() * 0.6);

      const requestsCount = Math.round(baseRequests * multiplier);
      const inputTokens = requestsCount * Math.round(650 + Math.random() * 400);
      const outputTokens =
        requestsCount * Math.round(220 + Math.random() * 180);

      // Средняя стоимость в зависимости от провайдера
      const ratePer1k =
        item.provider === "Anthropic"
          ? 0.012
          : item.provider === "OpenAI"
            ? 0.008
            : 0.002;

      const costMicroUsd = Math.round(
        ((inputTokens + outputTokens) / 1000) * ratePer1k * USD,
      );

      if (dateStr.startsWith(currentMonthPrefix)) {
        currentMonthSpend += costMicroUsd;
      }

      metricsBatch.push({
        id: crypto.randomUUID(),
        pipelineId,
        date: dateStr,
        environment: item.environment,
        requestsCount,
        inputTokens,
        outputTokens,
        costMicroUsd,
      });
    }

    // Если статус Blocked, искусственно подгоняем расход к лимиту
    if (item.status === "Blocked") {
      currentMonthSpend = item.limit + 12 * USD;
    } else if (item.status === "Warning") {
      currentMonthSpend = Math.round(item.target * 1.05);
    }

    await db.insert(apiPipelines).values({
      id: pipelineId,
      userId: currentUser.id,
      name: item.name,
      provider: item.provider,
      environment: item.environment,
      status: item.status,
      apiKeyHash,
      apiKeyPrefix: rawKey.slice(0, 11) + "...",
      targetMicroUsd: item.target,
      limitMicroUsd: item.limit,
      currentMonthSpendMicroUsd: currentMonthSpend,
      ownerName: item.ownerName,
      sortOrder: idx,
    });

    await db.insert(dailyUsageMetrics).values(metricsBatch);
  }

  console.log(
    "✅ Готово! Создано 7 AI-пайплайнов и 630 дневных срезов метрик.",
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Ошибка сидирования:", err);
  process.exit(1);
});
