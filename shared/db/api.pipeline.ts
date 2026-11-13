import {
  pgTable,
  text,
  integer,
  bigint,
  timestamp,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./schema";

// 1. Таблица API-пайплайнов / микросервисов (строки нашей главной таблицы)
export const apiPipelines = pgTable(
  "api_pipelines",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // Например: "Support AI Bot"
    provider: text("provider").notNull(), // "OpenAI" | "Anthropic" | "DeepSeek" | "Custom API"
    environment: text("environment").notNull().default("production"), // "production" | "staging"
    status: text("status").notNull().default("Active"), // "Active" | "Warning" | "Blocked"
    apiKeyHash: text("api_key_hash").notNull(),
    apiKeyPrefix: text("api_key_prefix").notNull(), // Например: "sk-fin-9a8b..."
    targetMicroUsd: bigint("target_micro_usd", { mode: "number" }).notNull(), // Мягкий план ($)
    limitMicroUsd: bigint("limit_micro_usd", { mode: "number" }).notNull(), // Жесткий лимит ($)
    currentMonthSpendMicroUsd: bigint("current_month_spend_micro_usd", {
      mode: "number",
    })
      .notNull()
      .default(0),
    ownerName: text("owner_name").notNull(), // Ответственный разработчик
    sortOrder: integer("sort_order").notNull().default(0), // Для Drag-and-Drop сортировки в таблице
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("api_pipelines_user_idx").on(table.userId)],
);

// 2. Агрегированная дневная статистика (для молниеносной отрисовки графика за 7/30/90 дней)
export const dailyUsageMetrics = pgTable(
  "daily_usage_metrics",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => apiPipelines.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // Формат YYYY-MM-DD
    environment: text("environment").notNull(), // "production" | "staging"
    requestsCount: integer("requests_count").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    outputTokens: bigint("output_tokens", { mode: "number" })
      .notNull()
      .default(0),
    costMicroUsd: bigint("cost_micro_usd", { mode: "number" })
      .notNull()
      .default(0),
  },
  (table) => [
    uniqueIndex("daily_usage_pipeline_date_idx").on(
      table.pipelineId,
      table.date,
    ),
    index("daily_usage_date_idx").on(table.date),
  ],
);

export type ApiPipeline = typeof apiPipelines.$inferSelect;
export type NewApiPipeline = typeof apiPipelines.$inferInsert;
export type DailyUsageMetric = typeof dailyUsageMetrics.$inferSelect;
