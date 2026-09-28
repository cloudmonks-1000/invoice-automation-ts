"use client";

import { useEffect, useState } from "react";

const API_URL = "";

interface SummaryData {
  total_invoices_processed?: number;
  successful_invoices?: number;
  failed_invoices?: number;
  duplicate_invoices?: number;
  total_bulk_jobs?: number;
}

function Summary() {
  const [data, setData] =
    useState<SummaryData | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const fetchSummary = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(`${API_URL}/api/dashboard`);

      if (!response.ok) {
        throw new Error(
          "Failed to fetch summary data"
        );
      }

      const result: SummaryData =
        await response.json();

      setData(result);
    } catch (err: unknown) {
      console.error("Summary error:", err);

      setError(
        "Unable to load summary data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

          <p className="text-xs font-medium text-slate-500">
            Loading summary...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <div className="p-1">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-sm font-bold text-red-600">
              !
            </div>

            <div>
              <p className="text-sm font-semibold text-red-800">
                Unable to load summary
              </p>

              <p className="mt-1 text-xs text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={fetchSummary}
                className="mt-3 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // DATA
  // =====================================================

  const total =
    data?.total_invoices_processed ?? 0;

  const successful =
    data?.successful_invoices ?? 0;

  const failed =
    data?.failed_invoices ?? 0;

  const duplicates =
    data?.duplicate_invoices ?? 0;

  const jobs =
    data?.total_bulk_jobs ?? 0;

  const successRate =
    total > 0
      ? ((successful / total) * 100).toFixed(1)
      : "0.0";

  const failedRate =
    total > 0
      ? ((failed / total) * 100).toFixed(1)
      : "0.0";

  const successPercentage = Math.min(
    Math.max(Number(successRate), 0),
    100
  );

  const failedPercentage = Math.min(
    Math.max(Number(failedRate), 0),
    100
  );

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="w-full">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
            Analytics
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Processing Summary
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            Invoice processing performance and operational metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h5M20 20v-5h-5M5.64 9A7 7 0 0118.36 6.64L20 9M18.36 15A7 7 0 015.64 17.36L4 15"
            />
          </svg>

          Refresh
        </button>
      </div>

      {/* =================================================
          KPI CARDS
      ================================================= */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <MetricCard
          label="Total Invoices"
          value={total}
          description="Processed invoices"
          type="neutral"
          icon={
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 3h8l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z"
              />

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 3v5h5M9 13h6M9 17h6"
              />
            </svg>
          }
        />

        <MetricCard
          label="Successful"
          value={successful}
          description={`${successRate}% success rate`}
          type="success"
          badge={`${successRate}%`}
          icon={
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12l4 4L19 6"
              />
            </svg>
          }
        />

        <MetricCard
          label="Failed"
          value={failed}
          description={`${failedRate}% failure rate`}
          type="danger"
          badge={`${failedRate}%`}
          icon={
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v5M12 16h.01"
              />

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.3 3.8L2.9 17a2 2 0 001.75 3h14.7a2 2 0 001.75-3L13.7 3.8a2 2 0 00-3.4 0z"
              />
            </svg>
          }
        />

        <MetricCard
          label="Duplicates"
          value={duplicates}
          description="Duplicate records"
          type="warning"
          icon={
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect
                x="8"
                y="8"
                width="11"
                height="11"
                rx="2"
              />

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"
              />
            </svg>
          }
        />
      </div>

      {/* =================================================
          PERFORMANCE + JOBS
      ================================================= */}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* PERFORMANCE */}

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Processing Performance
                </h2>

                <p className="mt-0.5 text-[11px] text-slate-400">
                  Success and failure distribution
                </p>
              </div>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 19V5M4 19h17"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 15l4-4 3 2 5-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="p-5">

            {/* Successful */}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Successful
                </span>

                <span className="text-xs font-bold text-emerald-600">
                  {successRate}%
                </span>
              </div>

              <div
                className="h-2 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={successPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Successful invoice percentage"
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${successPercentage}%`,
                  }}
                />
              </div>
            </div>

            {/* Failed */}

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Failed
                </span>

                <span className="text-xs font-bold text-red-600">
                  {failedRate}%
                </span>
              </div>

              <div
                className="h-2 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={failedPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Failed invoice percentage"
              >
                <div
                  className="h-full rounded-full bg-red-500 transition-all duration-500"
                  style={{
                    width: `${failedPercentage}%`,
                  }}
                />
              </div>
            </div>

            {/* Counts */}

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                  Successful
                </p>

                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {successful.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-red-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
                  Failed
                </p>

                <p className="mt-1 text-lg font-bold text-red-700">
                  {failed.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* JOB STATISTICS */}

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Job Statistics
                </h2>

                <p className="mt-0.5 text-[11px] text-slate-400">
                  Bulk processing activity
                </p>
              </div>

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="3"
                  />

                  <path
                    strokeLinecap="round"
                    d="M8 9h8M8 13h8M8 17h5"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 p-5">

            <JobRow
              label="Total Bulk Jobs"
              description="Processing batches"
              value={jobs}
              type="neutral"
            />

            <JobRow
              label="Successful Invoices"
              description="Completed successfully"
              value={successful}
              type="success"
            />

            <JobRow
              label="Failed Invoices"
              description="Require attention"
              value={failed}
              type="danger"
            />

            <JobRow
              label="Duplicate Invoices"
              description="Duplicate records"
              value={duplicates}
              type="warning"
            />
          </div>
        </section>
      </div>

      {/* =================================================
          SYSTEM STATUS
      ================================================= */}

      <section className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Overall Processing Status
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-400">
              Current invoice automation system status
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            <span className="text-xs font-bold text-emerald-700">
              System Operational
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// =====================================================
// METRIC CARD
// =====================================================

interface MetricCardProps {
  label: string;
  value: number;
  description: string;
  type:
    | "neutral"
    | "success"
    | "danger"
    | "warning";
  badge?: string;
  icon: React.ReactNode;
}

function MetricCard({
  label,
  value,
  description,
  type,
  badge,
  icon,
}: MetricCardProps) {
  const styles = {
    neutral: {
      icon: "bg-slate-100 text-slate-600",
      badge: "bg-slate-100 text-slate-500",
      value: "text-slate-900",
    },
    success: {
      icon: "bg-emerald-50 text-emerald-600",
      badge: "bg-emerald-50 text-emerald-600",
      value: "text-slate-900",
    },
    danger: {
      icon: "bg-red-50 text-red-600",
      badge: "bg-red-50 text-red-600",
      value: "text-slate-900",
    },
    warning: {
      icon: "bg-amber-50 text-amber-600",
      badge: "bg-amber-50 text-amber-600",
      value: "text-slate-900",
    },
  };

  const style = styles[type];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${style.icon}`}
        >
          {icon}
        </div>

        {badge && (
          <span
            className={`rounded-full px-2 py-1 text-[9px] font-bold ${style.badge}`}
          >
            {badge}
          </span>
        )}
      </div>

      <p className="mt-4 text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-2xl font-bold tracking-tight ${style.value}`}
      >
        {value.toLocaleString("en-IN")}
      </p>

      <p className="mt-1 text-[10px] text-slate-400">
        {description}
      </p>
    </div>
  );
}

// =====================================================
// JOB ROW
// =====================================================

interface JobRowProps {
  label: string;
  description: string;
  value: number;
  type:
    | "neutral"
    | "success"
    | "danger"
    | "warning";
}

function JobRow({
  label,
  description,
  value,
  type,
}: JobRowProps) {
  const styles = {
    neutral:
      "bg-slate-50 text-slate-900",
    success:
      "border border-emerald-100 bg-emerald-50 text-emerald-700",
    danger:
      "border border-red-100 bg-red-50 text-red-700",
    warning:
      "border border-amber-100 bg-amber-50 text-amber-700",
  };

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3.5 py-3 ${styles[type]}`}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold">
          {label}
        </p>

        <p className="mt-0.5 text-[10px] opacity-60">
          {description}
        </p>
      </div>

      <p className="ml-4 text-xl font-bold">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

export default Summary;