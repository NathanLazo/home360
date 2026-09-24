"use client";

import { getToolName, isToolUIPart } from "ai";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { AgentUIMessage } from "~/server/agent/home360-agent";

import { AgentDataCard } from "./agent-data-card";

type AgentPart = AgentUIMessage["parts"][number];

type Rec = Record<string, unknown>;

function rec(value: unknown): Rec | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

function arr(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Dates cross the UI stream as ISO strings; tolerate Date just in case. */
function when(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

type Formatters = {
  money: (cents: number) => string;
  int: (value: number) => string;
  date: (value: unknown) => string;
  bytes: (value: number) => string;
};

function buildFormatters(locale: string): Formatters {
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const int = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return {
    money: (cents) => money.format(cents / 100),
    int: (value) => int.format(value),
    date: (value) => {
      const parsed = when(value);

      return parsed ? date.format(parsed) : "—";
    },
    bytes: (value) =>
      value >= 1024 * 1024
        ? `${(value / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(value / 1024))} KB`,
  };
}

type Stat = { label: string; value: string; hint?: string };

function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0">
          <dt className="text-muted-foreground truncate text-[11px]">
            {stat.label}
          </dt>
          <dd className="text-foreground text-sm font-medium tabular-nums">
            {stat.value}
            {stat.hint ? (
              <span className="text-muted-foreground ml-1.5 text-[11px] font-normal">
                {stat.hint}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type Column = { key: string; label: string; align?: "right" };

function SimpleTable({
  columns,
  rows,
}: {
  columns: Column[];
  rows: Array<Record<string, ReactNode>>;
}) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={column.align === "right" ? "text-right" : undefined}
            >
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index}>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                className={
                  column.align === "right"
                    ? "text-right tabular-nums"
                    : undefined
                }
              >
                {row[column.key] ?? "—"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="bg-muted/60 text-muted-foreground rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase">
      {value}
    </span>
  );
}

function bankAccount(bank: string | null, last4: string | null): string {
  return bank && last4 ? `${bank} ···· ${last4}` : (bank ?? "—");
}

function deltaHint(value: number | null): string | undefined {
  return value === null ? undefined : `${value > 0 ? "+" : ""}${value}%`;
}

type Card = { title: string; summary?: string; content: ReactNode };

type Translate = ReturnType<typeof useTranslations<"agent.dashboard">>;

type Builder = (result: unknown, fmt: Formatters, t: Translate) => Card | null;

const buildPlatformKpis: Builder = (result, fmt, t) => {
  const data = rec(result);
  const gmv = num(data?.gmvCents);
  const escrow = num(data?.escrowCents);

  if (!data || gmv === null || escrow === null) {
    return null;
  }

  return {
    title: t("platformKpis.title"),
    summary: str(data.month) ?? undefined,
    content: (
      <StatGrid
        stats={[
          {
            label: t("platformKpis.gmv"),
            value: fmt.money(gmv),
            hint: deltaHint(num(data.gmvDeltaPct)),
          },
          {
            label: t("platformKpis.escrow"),
            value: fmt.money(escrow),
            hint: t("orders", { count: num(data.escrowOrdersCount) ?? 0 }),
          },
          {
            label: t("platformKpis.activeBusinesses"),
            value: fmt.int(num(data.activeBusinesses) ?? 0),
          },
          {
            label: t("platformKpis.pendingBusinesses"),
            value: fmt.int(num(data.pendingBusinesses) ?? 0),
          },
          {
            label: t("platformKpis.totalUsers"),
            value: fmt.int(num(data.totalUsers) ?? 0),
          },
          {
            label: t("platformKpis.newUsers"),
            value: fmt.int(num(data.newUsersMonth) ?? 0),
          },
        ]}
      />
    ),
  };
};

const buildFinanceKpis: Builder = (result, fmt, t) => {
  const data = rec(result);
  const gross = num(data?.platformGrossRevenueCents);

  if (!data || gross === null) {
    return null;
  }

  return {
    title: t("financeKpis.title"),
    summary: str(data.month) ?? undefined,
    content: (
      <StatGrid
        stats={[
          {
            label: t("financeKpis.gross"),
            value: fmt.money(gross),
            hint: deltaHint(num(data.platformGrossRevenueDeltaPct)),
          },
          {
            label: t("financeKpis.subscriptions"),
            value: fmt.money(num(data.subscriptionCents) ?? 0),
          },
          {
            label: t("financeKpis.escrow"),
            value: fmt.money(num(data.escrowCents) ?? 0),
            hint: t("orders", { count: num(data.escrowOrdersCount) ?? 0 }),
          },
          {
            label: t("financeKpis.pendingWithdrawals"),
            value: fmt.money(num(data.pendingWithdrawalsCents) ?? 0),
            hint: t("requests", {
              count: num(data.pendingWithdrawalsCount) ?? 0,
            }),
          },
          {
            label: t("financeKpis.activeBusinesses"),
            value: fmt.int(num(data.activeBusinesses) ?? 0),
          },
        ]}
      />
    ),
  };
};

const buildBusinessFinance: Builder = (result, fmt, t) => {
  const data = rec(result);
  const business = rec(data?.business);
  const balances = rec(data?.balances);
  const monthSales = rec(data?.monthSales);
  const available = num(balances?.availableCents);

  if (!data || !business || !balances || !monthSales || available === null) {
    return null;
  }

  const withdrawals = (arr(data.pendingWithdrawals) ?? [])
    .map(rec)
    .filter((row): row is Rec => row !== null);

  return {
    title: t("businessFinance.title", { name: str(business.name) ?? "—" }),
    summary: fmt.money(available),
    content: (
      <div className="flex flex-col gap-3">
        <StatGrid
          stats={[
            {
              label: t("businessFinance.available"),
              value: fmt.money(available),
            },
            {
              label: t("businessFinance.escrow"),
              value: fmt.money(num(balances.escrowCents) ?? 0),
              hint: t("orders", {
                count: num(balances.escrowOrdersCount) ?? 0,
              }),
            },
            {
              label: t("businessFinance.monthSales"),
              value: fmt.money(num(monthSales.grossCents) ?? 0),
              hint: t("payments", {
                count: num(monthSales.paymentsCount) ?? 0,
              }),
            },
            {
              label: t("businessFinance.monthCommission"),
              value: fmt.money(num(monthSales.commissionCents) ?? 0),
            },
            {
              label: t("businessFinance.loyaltyPending"),
              value: fmt.money(num(balances.loyaltyPendingCents) ?? 0),
            },
            {
              label: t("businessFinance.payouts"),
              value:
                business.payoutsEnabled === true
                  ? t("businessFinance.payoutsReady")
                  : t("businessFinance.payoutsNotReady"),
            },
          ]}
        />
        {withdrawals.length > 0 ? (
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">
              {t("businessFinance.pendingWithdrawals")}
            </p>
            <SimpleTable
              columns={[
                {
                  key: "amount",
                  label: t("withdrawals.amount"),
                  align: "right",
                },
                { key: "account", label: t("withdrawals.account") },
                { key: "date", label: t("withdrawals.requestedAt") },
              ]}
              rows={withdrawals.map((row) => ({
                amount: fmt.money(num(row.amountCents) ?? 0),
                account: bankAccount(str(row.bankName), str(row.accountLast4)),
                date: fmt.date(row.requestedAt),
              }))}
            />
          </div>
        ) : null}
      </div>
    ),
  };
};

const buildWithdrawal: Builder = (result, fmt, t) => {
  const data = rec(result);
  const business = rec(data?.business);
  const amount = num(data?.amountCents);

  if (!data || !business || amount === null) {
    return null;
  }

  const receipts = (arr(data.receipts) ?? [])
    .map(rec)
    .filter((row): row is Rec => row !== null);

  return {
    title: t("withdrawal.title", { name: str(business.name) ?? "—" }),
    summary: fmt.money(amount),
    content: (
      <div className="flex flex-col gap-3">
        <StatGrid
          stats={[
            { label: t("withdrawals.amount"), value: fmt.money(amount) },
            {
              label: t("withdrawals.account"),
              value: bankAccount(str(data.bankName), str(data.accountLast4)),
            },
            {
              label: t("withdrawals.status"),
              value: str(data.status) ?? "—",
            },
            {
              label: t("withdrawals.requestedAt"),
              value: fmt.date(data.requestedAt),
            },
          ]}
        />
        {receipts.length > 0 ? (
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">
              {t("receipts.title")}
            </p>
            <SimpleTable
              columns={[
                { key: "file", label: t("receipts.file") },
                { key: "size", label: t("receipts.size"), align: "right" },
                { key: "by", label: t("receipts.uploadedBy") },
                { key: "date", label: t("receipts.date") },
              ]}
              rows={receipts.map((row) => ({
                file: str(row.filename) ?? "—",
                size: fmt.bytes(num(row.sizeBytes) ?? 0),
                by: str(row.uploadedByName) ?? "—",
                date: fmt.date(row.createdAt),
              }))}
            />
          </div>
        ) : null}
      </div>
    ),
  };
};

const buildWithdrawals: Builder = (result, fmt, t) => {
  const data = rec(result);
  const items = (arr(data?.items) ?? [])
    .map(rec)
    .filter((row): row is Rec => row !== null);

  if (items.length === 0) {
    return null;
  }

  const total = items.reduce(
    (sum, row) => sum + (num(row.amountCents) ?? 0),
    0,
  );

  return {
    title: t("withdrawals.title"),
    summary: t("withdrawals.summary", {
      count: items.length,
      total: fmt.money(total),
    }),
    content: (
      <SimpleTable
        columns={[
          { key: "business", label: t("withdrawals.business") },
          { key: "amount", label: t("withdrawals.amount"), align: "right" },
          { key: "account", label: t("withdrawals.account") },
          { key: "status", label: t("withdrawals.status") },
          { key: "date", label: t("withdrawals.requestedAt") },
        ]}
        rows={items.map((row) => ({
          business: str(rec(row.business)?.name) ?? "—",
          amount: fmt.money(num(row.amountCents) ?? 0),
          account: bankAccount(str(row.bankName), str(row.accountLast4)),
          status: <StatusBadge value={str(row.status) ?? "—"} />,
          date: fmt.date(row.requestedAt),
        }))}
      />
    ),
  };
};

const buildSales: Builder = (result, fmt, t) => {
  const data = rec(result);
  const items = (arr(data?.items) ?? [])
    .map(rec)
    .filter((row): row is Rec => row !== null);

  if (items.length === 0) {
    return null;
  }

  const total = items.reduce(
    (sum, row) => sum + (num(row.amountCents) ?? 0),
    0,
  );

  return {
    title: t("sales.title"),
    summary: t("sales.summary", {
      count: items.length,
      total: fmt.money(total),
    }),
    content: (
      <SimpleTable
        columns={[
          { key: "concept", label: t("sales.concept") },
          { key: "amount", label: t("sales.amount"), align: "right" },
          { key: "commission", label: t("sales.commission"), align: "right" },
          { key: "net", label: t("sales.net"), align: "right" },
          { key: "status", label: t("sales.status") },
          { key: "date", label: t("sales.date") },
        ]}
        rows={items.map((row) => ({
          concept: str(row.concept) ?? str(row.customerName) ?? "—",
          amount: fmt.money(num(row.amountCents) ?? 0),
          commission: fmt.money(num(row.commissionCents) ?? 0),
          net: fmt.money(num(row.netAmountCents) ?? 0),
          status: <StatusBadge value={str(row.status) ?? "—"} />,
          date: fmt.date(row.createdAt),
        }))}
      />
    ),
  };
};

const buildReceipts: Builder = (result, fmt, t) => {
  const data = rec(result);
  const items = (arr(data?.items) ?? [])
    .map(rec)
    .filter((row): row is Rec => row !== null);

  if (items.length === 0) {
    return null;
  }

  return {
    title: t("receipts.title"),
    summary: t("receipts.summary", { count: items.length }),
    content: (
      <SimpleTable
        columns={[
          { key: "file", label: t("receipts.file") },
          { key: "business", label: t("receipts.business") },
          { key: "target", label: t("receipts.target") },
          { key: "size", label: t("receipts.size"), align: "right" },
          { key: "date", label: t("receipts.date") },
        ]}
        rows={items.map((row) => ({
          file: str(row.filename) ?? "—",
          business: str(rec(row.business)?.name) ?? "—",
          target: rec(row.withdrawal)
            ? t("receipts.withdrawal")
            : rec(row.loyaltyBonus)
              ? t("receipts.loyaltyBonus")
              : "—",
          size: fmt.bytes(num(row.sizeBytes) ?? 0),
          date: fmt.date(row.createdAt),
        }))}
      />
    ),
  };
};

/** Tools whose successful result renders as a collapsible dashboard card. */
const BUILDERS: Record<string, Builder> = {
  getPlatformKpis: buildPlatformKpis,
  getFinanceKpis: buildFinanceKpis,
  getBusinessFinance: buildBusinessFinance,
  getWithdrawal: buildWithdrawal,
  listWithdrawals: buildWithdrawals,
  listBusinessSales: buildSales,
  listPaymentReceipts: buildReceipts,
};

/** Successful `{ result, error }` envelope of a finished tool part, or null. */
function envelopeResult(part: AgentPart): unknown {
  if (!isToolUIPart(part) || part.state !== "output-available") {
    return null;
  }

  const output = rec(part.output);

  return output?.error === null && output.result !== undefined
    ? output.result
    : null;
}

/**
 * Renders the recognized tool results of one assistant message as a stack of
 * collapsed dashboard cards (KPI grids and tables), so rich data stays one
 * tap away without flooding the thread.
 */
export function AgentToolDashboards({ parts }: { parts: AgentPart[] }) {
  const t = useTranslations("agent.dashboard");
  const locale = useLocale();
  const fmt = useMemo(() => buildFormatters(locale), [locale]);

  const cards: Array<Card & { id: string }> = [];

  for (const part of parts) {
    if (!isToolUIPart(part)) {
      continue;
    }

    const builder = BUILDERS[getToolName(part)];
    const result = envelopeResult(part);

    if (!builder || result === null) {
      continue;
    }

    const card = builder(result, fmt, t);

    if (card) {
      cards.push({ ...card, id: part.toolCallId });
    }
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {cards.map((card) => (
        <AgentDataCard key={card.id} title={card.title} summary={card.summary}>
          {card.content}
        </AgentDataCard>
      ))}
    </div>
  );
}
