"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/shared/auth";
import { db } from "@/shared/db";
import { apiPipelines } from "@/shared/db/api.pipeline";
import { FinOpsRepository } from "./repository";

const USD = 1_000_000;

async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("Необходима авторизация");
  }
  return session.user;
}

const updateBudgetSchema = z.object({
  id: z.string().min(1),
  targetUsd: z.coerce.number().min(1).max(1_000_000),
  limitUsd: z.coerce.number().min(1).max(1_000_000),
});

const createPipelineSchema = z.object({
  name: z.string().min(2, "Минимум 2 символа").max(60),
  provider: z.enum(["OpenAI", "Anthropic", "DeepSeek", "Custom API"]),
  environment: z.enum(["production", "staging"]),
  targetUsd: z.coerce.number().min(1),
  limitUsd: z.coerce.number().min(1),
  ownerName: z.string().min(2).max(50),
});

// 1. Обновление Target и Limit прямо из таблицы или Drawer
export async function updatePipelineBudgetAction(input: {
  id: string;
  targetUsd: number;
  limitUsd: number;
}) {
  const user = await requireUser();
  const parsed = updateBudgetSchema.parse(input);

  const [existing] = await db
    .select()
    .from(apiPipelines)
    .where(
      and(eq(apiPipelines.id, parsed.id), eq(apiPipelines.userId, user.id)),
    );

  if (!existing) {
    throw new Error("Пайплайн не найден");
  }

  const targetMicro = Math.round(parsed.targetUsd * USD);
  const limitMicro = Math.round(parsed.limitUsd * USD);

  // Автоматический пересчет статуса на основе нового лимита
  let nextStatus = "Active";
  if (existing.currentMonthSpendMicroUsd >= limitMicro) {
    nextStatus = "Blocked";
  } else if (existing.currentMonthSpendMicroUsd >= targetMicro) {
    nextStatus = "Warning";
  }

  await db
    .update(apiPipelines)
    .set({
      targetMicroUsd: targetMicro,
      limitMicroUsd: limitMicro,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(
      and(eq(apiPipelines.id, parsed.id), eq(apiPipelines.userId, user.id)),
    );

  await FinOpsRepository.invalidateUserCache(user.id);
  revalidatePath("/dashboard");

  return { ok: true, status: nextStatus };
}

// 2. Смена ответственного разработчика
export async function updatePipelineOwnerAction(id: string, ownerName: string) {
  const user = await requireUser();
  const cleanOwner = z.string().min(2).max(50).parse(ownerName);

  await db
    .update(apiPipelines)
    .set({ ownerName: cleanOwner, updatedAt: new Date() })
    .where(and(eq(apiPipelines.id, id), eq(apiPipelines.userId, user.id)));

  await FinOpsRepository.invalidateUserCache(user.id);
  revalidatePath("/dashboard");

  return { ok: true };
}

// 3. Создание нового API-пайплайна с генерацией реального секретного ключа
export async function createPipelineAction(
  input: z.infer<typeof createPipelineSchema>,
) {
  const user = await requireUser();
  const parsed = createPipelineSchema.parse(input);

  const id = `pipe_${crypto.randomBytes(6).toString("hex")}`;
  const rawApiKey = `sk-fin-${crypto.randomBytes(20).toString("hex")}`;
  const apiKeyHash = crypto
    .createHash("sha256")
    .update(rawApiKey)
    .digest("hex");

  await db.insert(apiPipelines).values({
    id,
    userId: user.id,
    name: parsed.name,
    provider: parsed.provider,
    environment: parsed.environment,
    status: "Active",
    apiKeyHash,
    apiKeyPrefix: rawApiKey.slice(0, 11) + "...",
    targetMicroUsd: Math.round(parsed.targetUsd * USD),
    limitMicroUsd: Math.round(parsed.limitUsd * USD),
    currentMonthSpendMicroUsd: 0,
    ownerName: parsed.ownerName,
    sortOrder: 0,
  });

  await FinOpsRepository.invalidateUserCache(user.id);
  revalidatePath("/dashboard");

  // Возвращаем полный ключ ОДИН РАЗ (как в Stripe/OpenAI), в БД хранится только SHA-256 хеш
  return { ok: true, rawApiKey };
}

// 4. Удаление пайплайна
export async function deletePipelineAction(id: string) {
  const user = await requireUser();
  z.string().min(1).parse(id);

  await db
    .delete(apiPipelines)
    .where(and(eq(apiPipelines.id, id), eq(apiPipelines.userId, user.id)));

  await FinOpsRepository.invalidateUserCache(user.id);
  revalidatePath("/dashboard");

  return { ok: true };
}
