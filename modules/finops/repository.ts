import { db } from "@/shared/db";
import { apiPipelines, dailyUsageMetrics } from "@/shared/db/api.pipeline";
import { redis } from "@/shared/redis";
import { eq, asc, and, gte, sql } from "drizzle-orm";

const USD = 1_000_000;

export interface DashboardKpiDTO {
  totalSpendUsd: number;
  totalTokensK: number;
  activePipelinesCount: number;
  totalPipelinesCount: number;
  budgetUtilizationPercent: number;
}

export interface ChartPointDTO {
  date: string;
  production: number;
  staging: number;
}

export interface PipelineRowDTO {
  id: string;
  name: string;
  provider: string;
  environment: string;
  status: string;
  apiKeyPrefix: string;
  targetUsd: number;
  limitUsd: number;
  spendUsd: number;
  ownerName: string;
}

export class FinOpsRepository {
  // 1. Агрегация для 4 верхних карточек с кэшем в Redis (TTL 60 сек)
  static async getDashboardKpis(userId: string): Promise<DashboardKpiDTO> {
    const cacheKey = `finops:kpis:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as DashboardKpiDTO;
    }

    const pipelines = await db
      .select()
      .from(apiPipelines)
      .where(eq(apiPipelines.userId, userId));

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 30);
    const thirtyDaysStr = ninetyDaysAgo.toISOString().slice(0, 10);

    const [tokensAgg] = await db
      .select({
        totalTokens: sql<number>`coalesce(sum(${dailyUsageMetrics.inputTokens} + ${dailyUsageMetrics.outputTokens}), 0)`,
      })
      .from(dailyUsageMetrics)
      .innerJoin(
        apiPipelines,
        eq(dailyUsageMetrics.pipelineId, apiPipelines.id),
      )
      .where(
        and(
          eq(apiPipelines.userId, userId),
          gte(dailyUsageMetrics.date, thirtyDaysStr),
        ),
      );

    let totalSpendMicro = 0;
    let totalLimitMicro = 0;
    let activeCount = 0;

    for (const p of pipelines) {
      totalSpendMicro += p.currentMonthSpendMicroUsd;
      totalLimitMicro += p.limitMicroUsd;
      if (p.status === "Active" || p.status === "Warning") {
        activeCount++;
      }
    }

    const result: DashboardKpiDTO = {
      totalSpendUsd: Number((totalSpendMicro / USD).toFixed(2)),
      totalTokensK: Math.round(Number(tokensAgg?.totalTokens ?? 0) / 1000),
      activePipelinesCount: activeCount,
      totalPipelinesCount: pipelines.length,
      budgetUtilizationPercent:
        totalLimitMicro > 0
          ? Number(((totalSpendMicro / totalLimitMicro) * 100).toFixed(1))
          : 0,
    };

    await redis.set(cacheKey, JSON.stringify(result), "EX", 60);
    return result;
  }

  // 2. Временной ряд за 90 дней для интерактивного графика (Production vs Staging)
  static async getChartSeries(userId: string): Promise<ChartPointDTO[]> {
    const cacheKey = `finops:chart:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ChartPointDTO[];
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const startDateStr = startDate.toISOString().slice(0, 10);

    const rows = await db
      .select({
        date: dailyUsageMetrics.date,
        environment: dailyUsageMetrics.environment,
        costMicro: sql<number>`coalesce(sum(${dailyUsageMetrics.costMicroUsd}), 0)`,
      })
      .from(dailyUsageMetrics)
      .innerJoin(
        apiPipelines,
        eq(dailyUsageMetrics.pipelineId, apiPipelines.id),
      )
      .where(
        and(
          eq(apiPipelines.userId, userId),
          gte(dailyUsageMetrics.date, startDateStr),
        ),
      )
      .groupBy(dailyUsageMetrics.date, dailyUsageMetrics.environment)
      .orderBy(asc(dailyUsageMetrics.date));

    // Группируем по дате в словарь { date -> { production, staging } }
    const grouped = new Map<string, ChartPointDTO>();

    for (const row of rows) {
      const entry = grouped.get(row.date) ?? {
        date: row.date,
        production: 0,
        staging: 0,
      };
      const usdVal = Number((Number(row.costMicro) / USD).toFixed(2));
      if (row.environment === "production") {
        entry.production = usdVal;
      } else {
        entry.staging = usdVal;
      }
      grouped.set(row.date, entry);
    }

    const series = Array.from(grouped.values());
    await redis.set(cacheKey, JSON.stringify(series), "EX", 60);
    return series;
  }

  // 3. Список пайплайнов для главной таблицы
  static async getUserPipelines(userId: string): Promise<PipelineRowDTO[]> {
    const rows = await db
      .select()
      .from(apiPipelines)
      .where(eq(apiPipelines.userId, userId))
      .orderBy(asc(apiPipelines.sortOrder));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      provider: r.provider,
      environment: r.environment,
      status: r.status,
      apiKeyPrefix: r.apiKeyPrefix,
      targetUsd: Math.round(r.targetMicroUsd / USD),
      limitUsd: Math.round(r.limitMicroUsd / USD),
      spendUsd: Number((r.currentMonthSpendMicroUsd / USD).toFixed(2)),
      ownerName: r.ownerName,
    }));
  }

  // Инвалидация кэша пользователя при любых изменениях
  static async invalidateUserCache(userId: string) {
    await redis.del(`finops:kpis:${userId}`, `finops:chart:${userId}`);
  }
}
