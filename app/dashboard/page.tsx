import { AppSidebar } from "@/components/app-sidebar";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import data from "./data.json";
import { auth } from "@/shared/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FinOpsRepository } from "@/modules/finops/repository";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Параллельная загрузка метрик из Postgres / Redis
  const [kpis, chartData, pipelines] = await Promise.all([
    FinOpsRepository.getDashboardKpis(session.user.id),
    FinOpsRepository.getChartSeries(session.user.id),
    FinOpsRepository.getUserPipelines(session.user.id),
  ]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={{
          name: session.user.name,
          email: session.user.email,
          avatar: session.user.image ?? "",
        }}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards kpis={kpis} />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive data={chartData} />
              </div>
              <DataTable data={pipelines} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
