"use client";

import * as React from "react";
import { PlusIcon, CopyIcon, CheckIcon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { createPipelineAction } from "@/modules/finops/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export function CreatePipelineDialog() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Поля формы
  const [name, setName] = React.useState("");
  const [provider, setProvider] = React.useState<
    "OpenAI" | "Anthropic" | "DeepSeek" | "Custom API"
  >("OpenAI");
  const [environment, setEnvironment] = React.useState<
    "production" | "staging"
  >("production");
  const [targetUsd, setTargetUsd] = React.useState("100");
  const [limitUsd, setLimitUsd] = React.useState("150");
  const [ownerName, setOwnerName] = React.useState("Alex Mercer");

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:8080";

  function resetForm() {
    setName("");
    setProvider("OpenAI");
    setEnvironment("production");
    setTargetUsd("100");
    setLimitUsd("150");
    setCreatedKey(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createPipelineAction({
        name,
        provider,
        environment,
        targetUsd: Number(targetUsd),
        limitUsd: Number(limitUsd),
        ownerName,
      });

      if (res.ok && res.rawApiKey) {
        setCreatedKey(res.rawApiKey);
        toast.success("Пайплайн создан! Сохраните API-ключ.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Ошибка при создании пайплайна",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    toast.success("API-ключ скопирован в буфер обмена");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <PlusIcon className="size-4" />
            <span className="hidden lg:inline">Add Pipeline</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        {!createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Новый AI / API пайплайн</DialogTitle>
              <DialogDescription>
                Создайте изолированный ключ с контролем мягкого бюджета и
                жесткой блокировкой Hard Cap.
              </DialogDescription>
            </DialogHeader>
            <form
              id="create-pipeline-form"
              onSubmit={handleSubmit}
              className="grid gap-4 py-2"
            >
              <div className="grid gap-2">
                <Label htmlFor="pipe-name">Название сервиса</Label>
                <Input
                  id="pipe-name"
                  placeholder="Например: Telegram AI Bot"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="pipe-provider">Провайдер</Label>
                  <Select
                    value={provider}
                    onValueChange={(val) => {
                      if (val) setProvider(val as typeof provider);
                    }}
                    items={[
                      { label: "OpenAI", value: "OpenAI" },
                      { label: "Anthropic", value: "Anthropic" },
                      { label: "DeepSeek", value: "DeepSeek" },
                      { label: "Custom API", value: "Custom API" },
                    ]}
                  >
                    <SelectTrigger id="pipe-provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="OpenAI">OpenAI</SelectItem>
                        <SelectItem value="Anthropic">Anthropic</SelectItem>
                        <SelectItem value="DeepSeek">DeepSeek</SelectItem>
                        <SelectItem value="Custom API">Custom API</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="pipe-env">Окружение</Label>
                  <Select
                    value={environment}
                    onValueChange={(val) => {
                      if (val) setEnvironment(val as typeof environment);
                    }}
                    items={[
                      { label: "Production", value: "production" },
                      { label: "Staging", value: "staging" },
                    ]}
                  >
                    <SelectTrigger id="pipe-env" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="pipe-target">Soft Target ($)</Label>
                  <Input
                    id="pipe-target"
                    type="number"
                    min={1}
                    required
                    value={targetUsd}
                    onChange={(e) => setTargetUsd(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pipe-limit">Hard Limit ($)</Label>
                  <Input
                    id="pipe-limit"
                    type="number"
                    min={1}
                    required
                    value={limitUsd}
                    onChange={(e) => setLimitUsd(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pipe-owner">Ответственный (Owner)</Label>
                <Input
                  id="pipe-owner"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>
            </form>
            <DialogFooter>
              <Button
                type="submit"
                form="create-pipeline-form"
                disabled={loading}
              >
                {loading ? "Генерация ключа..." : "Создать и получить ключ"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRoundIcon className="size-5 text-primary" />
                Ваш секретный API-ключ готов
              </DialogTitle>
              <DialogDescription>
                Скопируйте этот ключ сейчас. В целях безопасности мы храним в
                базе только его SHA-256 хеш и больше не сможем показать его
                полностью.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 py-3">
              <Input
                readOnly
                value={createdKey}
                className="font-mono text-xs bg-muted"
              />
              <Button type="button" size="icon" onClick={handleCopy}>
                {copied ? (
                  <CheckIcon className="size-4 text-green-500" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
              </Button>
            </div>
            <div className="rounded-md bg-muted/60 p-3 font-mono text-xs text-muted-foreground overflow-x-auto">
              curl -X POST {origin}/api/v1/ingest \<br />
              &nbsp;&nbsp;-H &quot;Authorization: Bearer {createdKey}&quot; \
              <br />
              &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br />
              &nbsp;&nbsp;-d &apos;
              {`{"model":"gpt-4o","inputTokens":15000,"outputTokens":4200}`}
              &apos;
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Готово
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
