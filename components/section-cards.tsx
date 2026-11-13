"use client";

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type { DashboardKpiDTO } from "@/modules/finops/repository";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SectionCards({ kpis }: { kpis: DashboardKpiDTO }) {
  const isOverBudget = kpis.budgetUtilizationPercent > 85;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {/* Карточка 1: Общий расход за месяц */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Monthly Spend</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            $
            {kpis.totalSpendUsd.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon className="size-3.5" />
              +12.4%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Расходы в рамках прогноза <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Суммарно по всем активным ключам
          </div>
        </CardFooter>
      </Card>

      {/* Карточка 2: Обработанные токены */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Tokens Processed (30d)</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {kpis.totalTokensK.toLocaleString("en-US")}k
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon className="size-3.5" />
              +8.2%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Стабильный поток запросов <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Prompt + Completion за 30 дней
          </div>
        </CardFooter>
      </Card>

      {/* Карточка 3: Активные пайплайны */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Pipelines</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {kpis.activePipelinesCount} / {kpis.totalPipelinesCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon className="size-3.5" />
              Online
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {kpis.totalPipelinesCount - kpis.activePipelinesCount} заблокировано
            по лимиту
          </div>
          <div className="text-muted-foreground">
            Авто-защита Redis Hard Cap активна
          </div>
        </CardFooter>
      </Card>

      {/* Карточка 4: Утилизация бюджета */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Budget Utilization</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {kpis.budgetUtilizationPercent}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {isOverBudget ? (
                <TrendingUpIcon className="size-3.5 text-destructive" />
              ) : (
                <TrendingDownIcon className="size-3.5" />
              )}
              {isOverBudget ? "High" : "Normal"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {isOverBudget
              ? "Приближение к Hard Cap"
              : "Оптимальный расход квот"}
          </div>
          <div className="text-muted-foreground">
            От общего лимита всех сервисов
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
