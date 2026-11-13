"use client";

import * as React from "react";

import type { PipelineRowDTO } from "@/modules/finops/repository";
import {
  updatePipelineBudgetAction,
  updatePipelineOwnerAction,
  deletePipelineAction,
} from "@/modules/finops/actions";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";
import { z } from "zod";

import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GripVerticalIcon,
  CircleCheckIcon,
  LoaderIcon,
  EllipsisVerticalIcon,
  Columns3Icon,
  ChevronDownIcon,
  PlusIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  BanIcon,
} from "lucide-react";
import { CreatePipelineDialog } from "./create-pipeline-dialog";

// New in v9: declare the features this table uses — anything you don't
// register is tree-shaken out of the bundle.
const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});

const columnHelper = createColumnHelper<
  typeof features,
  z.infer<typeof schema>
>();

export const schema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  environment: z.string(),
  status: z.string(),
  apiKeyPrefix: z.string(),
  targetUsd: z.number(),
  limitUsd: z.number(),
  spendUsd: z.number(),
  ownerName: z.string(),
});

const TEAM_MEMBERS = [
  "Alex Mercer",
  "Elena Rostova",
  "Marcus Vance",
  "Dmitry Volkov",
];

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({
    id,
  });
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}
const columns = columnHelper.columns([
  columnHelper.display({
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  }),
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.accessor("name", {
    header: "Pipeline / Service",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <TableCellViewer item={row.original} />
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.apiKeyPrefix}
        </span>
      </div>
    ),
    enableHiding: false,
  }),
  columnHelper.accessor("provider", {
    header: "Provider & Env",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {row.original.provider}
        </Badge>
        <Badge
          variant={
            row.original.environment === "production" ? "default" : "secondary"
          }
          className="px-1.5 text-[10px] uppercase"
        >
          {row.original.environment === "production" ? "prod" : "stg"}
        </Badge>
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant="outline" className="gap-1.5 px-2 text-muted-foreground">
          {status === "Active" && (
            <CircleCheckIcon className="size-3.5 fill-green-500 text-background dark:fill-green-400" />
          )}
          {status === "Warning" && (
            <AlertTriangleIcon className="size-3.5 text-amber-500" />
          )}
          {status === "Blocked" && (
            <BanIcon className="size-3.5 text-destructive" />
          )}
          <span>{status}</span>
        </Badge>
      );
    },
  }),
  columnHelper.accessor("spendUsd", {
    header: () => <div className="w-full text-right">Spend ($)</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono font-medium tabular-nums">
        ${row.original.spendUsd.toFixed(2)}
      </div>
    ),
  }),
  columnHelper.accessor("targetUsd", {
    header: () => <div className="w-full text-right">Target ($)</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const nextTarget = Number(formData.get("targetUsd"));
          if (!Number.isFinite(nextTarget) || nextTarget <= 0) return;

          toast.promise(
            updatePipelineBudgetAction({
              id: row.original.id,
              targetUsd: nextTarget,
              limitUsd: row.original.limitUsd,
            }),
            {
              loading: `Обновляем Target для ${row.original.name}...`,
              success: "Target сохранен",
              error: "Ошибка сохранения Target",
            },
          );
        }}
      >
        <Label htmlFor={`${row.original.id}-target`} className="sr-only">
          Target ($)
        </Label>
        <Input
          name="targetUsd"
          type="number"
          min={1}
          step={1}
          className="h-8 w-20 border-transparent bg-transparent text-right font-mono tabular-nums shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background"
          defaultValue={row.original.targetUsd}
          key={`${row.original.id}-target-${row.original.targetUsd}`}
          id={`${row.original.id}-target`}
        />
      </form>
    ),
  }),
  columnHelper.accessor("limitUsd", {
    header: () => <div className="w-full text-right">Hard Limit ($)</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const nextLimit = Number(formData.get("limitUsd"));
          if (!Number.isFinite(nextLimit) || nextLimit <= 0) return;

          toast.promise(
            updatePipelineBudgetAction({
              id: row.original.id,
              targetUsd: row.original.targetUsd,
              limitUsd: nextLimit,
            }),
            {
              loading: `Обновляем Hard Limit для ${row.original.name}...`,
              success: "Hard Limit сохранен",
              error: "Ошибка сохранения Limit",
            },
          );
        }}
      >
        <Label htmlFor={`${row.original.id}-limit`} className="sr-only">
          Hard Limit ($)
        </Label>
        <Input
          name="limitUsd"
          type="number"
          min={1}
          step={1}
          className="h-8 w-20 border-transparent bg-transparent text-right font-mono tabular-nums shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background"
          defaultValue={row.original.limitUsd}
          key={`${row.original.id}-limit-${row.original.limitUsd}`}
          id={`${row.original.id}-limit`}
        />
      </form>
    ),
  }),
  columnHelper.accessor("ownerName", {
    header: "Owner",
    cell: ({ row }) => (
      <>
        <Label htmlFor={`${row.original.id}-owner`} className="sr-only">
          Owner
        </Label>
        <Select
          value={row.original.ownerName}
          onValueChange={(value) => {
            if (!value || value === row.original.ownerName) return;
            toast.promise(updatePipelineOwnerAction(row.original.id, value), {
              loading: "Назначаем ответственного...",
              success: `Ответственный: ${value}`,
              error: "Ошибка назначения",
            });
          }}
          items={TEAM_MEMBERS.map((member) => ({
            label: member,
            value: member,
          }))}
        >
          <SelectTrigger
            className="w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
            size="sm"
            id={`${row.original.id}-owner`}
          >
            <SelectValue placeholder="Assign owner" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {TEAM_MEMBERS.map((member) => (
                <SelectItem key={member} value={member}>
                  {member}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </>
    ),
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="flex size-8 text-muted-foreground data-open:bg-muted"
              size="icon"
            />
          }
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(row.original.id);
              toast.success("Pipeline ID скопирован");
            }}
          >
            Copy ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              toast.promise(deletePipelineAction(row.original.id), {
                loading: `Удаляем ${row.original.name}...`,
                success: "Пайплайн удален",
                error: "Ошибка удаления",
              });
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  }),
]);
function DraggableRow({
  row,
}: {
  row: Row<typeof features, z.infer<typeof schema>>;
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  });
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  );
}
export function DataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[];
}) {
  const [data, setData] = React.useState(() => initialData);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<ColumnVisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );
  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data],
  );
  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  });
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id);
        const newIndex = dataIds.indexOf(over.id);
        return arrayMove(data, oldIndex, newIndex);
      });
    }
  }
  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select
          defaultValue="outline"
          items={[
            { label: "Outline", value: "outline" },
            { label: "Past Performance", value: "past-performance" },
            { label: "Key Personnel", value: "key-personnel" },
            { label: "Focus Documents", value: "focus-documents" },
          ]}
        >
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="outline">Outline</SelectItem>
              <SelectItem value="past-performance">Past Performance</SelectItem>
              <SelectItem value="key-personnel">Key Personnel</SelectItem>
              <SelectItem value="focus-documents">Focus Documents</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="past-performance">
            Past Performance <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Key Personnel <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <Columns3Icon data-icon="inline-start" />
              Columns
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide(),
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <CreatePipelineDialog />
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : (
                            <FlexRender header={header} />
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.state.pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
                items={[10, 20, 30, 40, 50].map((pageSize) => ({
                  label: `${pageSize}`,
                  value: `${pageSize}`,
                }))}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={table.state.pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.state.pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value="past-performance"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="key-personnel" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent
        value="focus-documents"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
    </Tabs>
  );
}
const chartData = [
  {
    month: "January",
    desktop: 186,
    mobile: 80,
  },
  {
    month: "February",
    desktop: 305,
    mobile: 200,
  },
  {
    month: "March",
    desktop: 237,
    mobile: 120,
  },
  {
    month: "April",
    desktop: 73,
    mobile: 190,
  },
  {
    month: "May",
    desktop: 209,
    mobile: 130,
  },
  {
    month: "June",
    desktop: 214,
    mobile: 140,
  },
];
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--primary)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile();
  const [targetUsd, setTargetUsd] = React.useState(String(item.targetUsd));
  const [limitUsd, setLimitUsd] = React.useState(String(item.limitUsd));
  const [ownerName, setOwnerName] = React.useState(item.ownerName);
  const [saving, setSaving] = React.useState(false);

  // Синхронизируем локальный стейт формы при обновлении данных с сервера
  React.useEffect(() => {
    setTargetUsd(String(item.targetUsd));
    setLimitUsd(String(item.limitUsd));
    setOwnerName(item.ownerName);
  }, [item.targetUsd, item.limitUsd, item.ownerName]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const nextTarget = Number(targetUsd);
    const nextLimit = Number(limitUsd);

    if (!Number.isFinite(nextTarget) || nextTarget <= 0) {
      toast.error("Укажите корректный Target ($)");
      return;
    }
    if (!Number.isFinite(nextLimit) || nextLimit <= 0) {
      toast.error("Укажите корректный Hard Limit ($)");
      return;
    }

    setSaving(true);
    try {
      await updatePipelineBudgetAction({
        id: item.id,
        targetUsd: nextTarget,
        limitUsd: nextLimit,
      });

      if (ownerName && ownerName !== item.ownerName) {
        await updatePipelineOwnerAction(item.id, ownerName);
      }

      toast.success(`Настройки для «${item.name}» сохранены`);
    } catch {
      toast.error("Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  }

  const utilization =
    item.limitUsd > 0
      ? Math.min(100, Math.round((item.spendUsd / item.limitUsd) * 100))
      : 0;

  return (
    <Drawer swipeDirection={isMobile ? "down" : "right"}>
      <DrawerTrigger
        render={
          <Button
            variant="link"
            className="h-auto w-fit p-0 text-left font-medium text-foreground"
          />
        }
      >
        {item.name}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.name}</DrawerTitle>
          <DrawerDescription className="font-mono text-xs">
            {item.provider} • {item.environment} • Key: {item.apiKeyPrefix}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {!isMobile && (
            <>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 0,
                    right: 10,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                    hide
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="mobile"
                    type="natural"
                    fill="var(--color-mobile)"
                    fillOpacity={0.6}
                    stroke="var(--color-mobile)"
                    stackId="a"
                  />
                  <Area
                    dataKey="desktop"
                    type="natural"
                    fill="var(--color-desktop)"
                    fillOpacity={0.4}
                    stroke="var(--color-desktop)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
              <Separator />
              <div className="grid gap-2">
                <div className="flex items-center justify-between font-medium leading-none">
                  <span>
                    Текущий расход: ${item.spendUsd.toFixed(2)} ({utilization}%
                    от лимита)
                  </span>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <div className="text-muted-foreground">
                  При достижении Hard Limit (${item.limitUsd}) прокси-шлюз
                  автоматически заблокирует запросы по этому API-ключу.
                </div>
              </div>
              <Separator />
            </>
          )}
          <form
            id={`drawer-form-${item.id}`}
            onSubmit={handleSave}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`drawer-provider-${item.id}`}>Provider</Label>
                <Input
                  id={`drawer-provider-${item.id}`}
                  value={item.provider}
                  disabled
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`drawer-env-${item.id}`}>Environment</Label>
                <Input
                  id={`drawer-env-${item.id}`}
                  value={item.environment}
                  disabled
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`drawer-target-${item.id}`}>
                  Soft Target ($)
                </Label>
                <Input
                  id={`drawer-target-${item.id}`}
                  type="number"
                  min={1}
                  value={targetUsd}
                  onChange={(e) => setTargetUsd(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`drawer-limit-${item.id}`}>
                  Hard Limit ($)
                </Label>
                <Input
                  id={`drawer-limit-${item.id}`}
                  type="number"
                  min={1}
                  value={limitUsd}
                  onChange={(e) => setLimitUsd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`drawer-owner-${item.id}`}>Owner</Label>
              <Select
                value={ownerName}
                onValueChange={(value) => {
                  if (value) setOwnerName(value);
                }}
                items={TEAM_MEMBERS.map((member) => ({
                  label: member,
                  value: member,
                }))}
              >
                <SelectTrigger
                  id={`drawer-owner-${item.id}`}
                  className="w-full"
                >
                  <SelectValue placeholder="Assign owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TEAM_MEMBERS.map((member) => (
                      <SelectItem key={member} value={member}>
                        {member}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </form>
        </div>
        <DrawerFooter>
          <Button
            type="submit"
            form={`drawer-form-${item.id}`}
            disabled={saving}
          >
            {saving ? "Сохраняем..." : "Save Changes"}
          </Button>
          <DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
