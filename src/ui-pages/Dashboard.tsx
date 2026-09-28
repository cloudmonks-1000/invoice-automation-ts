"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = "";

interface RecentActivity {
  job_id: string;
  processed_at: string | null;
  total_count: number;
  successful_count: number;
  failed_count: number;
  duplicate_count: number;
}

interface DashboardData {
  success: boolean;
  total_invoices_processed: number;
  successful_invoices: number;
  failed_invoices: number;
  total_bulk_jobs: number;
  duplicate_invoices: number;
  recent_activity: RecentActivity[];
}

function Dashboard() {
  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  // =====================================================
  // FETCH DASHBOARD
  // =====================================================

  const fetchDashboard = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/dashboard`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load dashboard data."
        );
      }

      const data: DashboardData =
        await response.json();

      setDashboard(data);
    } catch (err: unknown) {
      console.error(
        "Dashboard error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDateTime = (
    value: string | null | undefined
  ): string => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const formatShortDate = (
    value: string | null | undefined
  ): string => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
      }
    );
  };

  // =====================================================
  // DATA
  // =====================================================

  const totalInvoices =
    dashboard?.total_invoices_processed ?? 0;

  const successfulInvoices =
    dashboard?.successful_invoices ?? 0;

  const failedInvoices =
    dashboard?.failed_invoices ?? 0;

  const totalBulkJobs =
    dashboard?.total_bulk_jobs ?? 0;

  const duplicateInvoices =
    dashboard?.duplicate_invoices ?? 0;

  const successRate =
    totalInvoices > 0
      ? Math.round(
          (successfulInvoices /
            totalInvoices) *
            100
        )
      : 0;

  const recentActivity =
    dashboard?.recent_activity ?? [];

  // =====================================================
  // ANALYTICS FROM RECENT ACTIVITY
  // =====================================================

  const analytics = useMemo(() => {
    const total =
      recentActivity.reduce(
        (sum, item) =>
          sum +
          (item.total_count || 0),
        0
      );

    const successful =
      recentActivity.reduce(
        (sum, item) =>
          sum +
          (item.successful_count || 0),
        0
      );

    const failed =
      recentActivity.reduce(
        (sum, item) =>
          sum +
          (item.failed_count || 0),
        0
      );

    const duplicates =
      recentActivity.reduce(
        (sum, item) =>
          sum +
          (item.duplicate_count || 0),
        0
      );

    const jobs =
      recentActivity.length;

    const recentSuccessRate =
      total > 0
        ? Math.round(
            (successful / total) *
              100
          )
        : 0;

    const recentFailureRate =
      total > 0
        ? Math.round(
            (failed / total) *
              100
          )
        : 0;

    const recentDuplicateRate =
      total > 0
        ? Math.round(
            (duplicates / total) *
              100
          )
        : 0;

    const averagePerJob =
      jobs > 0
        ? Math.round(total / jobs)
        : 0;

    const largestJob =
      recentActivity.reduce(
        (
          largest,
          item
        ) => {
          if (
            !largest ||
            item.total_count >
              largest.total_count
          ) {
            return item;
          }

          return largest;
        },
        null as RecentActivity | null
      );

    const dailyMap =
      new Map<
        string,
        {
          label: string;
          total: number;
          successful: number;
          failed: number;
          duplicates: number;
        }
      >();

    recentActivity.forEach(
      (item) => {
        if (!item.processed_at) {
          return;
        }

        const date =
          new Date(
            item.processed_at
          );

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return;
        }

        const key =
          date.toISOString().slice(
            0,
            10
          );

        const label =
          date.toLocaleDateString(
            "en-IN",
            {
              day: "2-digit",
              month: "short",
            }
          );

        const existing =
          dailyMap.get(key);

        if (existing) {
          existing.total +=
            item.total_count || 0;

          existing.successful +=
            item.successful_count ||
            0;

          existing.failed +=
            item.failed_count || 0;

          existing.duplicates +=
            item.duplicate_count ||
            0;
        } else {
          dailyMap.set(
            key,
            {
              label,
              total:
                item.total_count ||
                0,
              successful:
                item.successful_count ||
                0,
              failed:
                item.failed_count ||
                0,
              duplicates:
                item.duplicate_count ||
                0,
            }
          );
        }
      }
    );

    const dailyActivity =
      Array.from(
        dailyMap.entries()
      )
        .sort(
          ([a], [b]) =>
            a.localeCompare(b)
        )
        .slice(-7)
        .map(
          ([key, value]) => ({
            key,
            ...value,
          })
        );

    return {
      total,
      successful,
      failed,
      duplicates,
      jobs,
      recentSuccessRate,
      recentFailureRate,
      recentDuplicateRate,
      averagePerJob,
      largestJob,
      dailyActivity,
    };
  }, [recentActivity]);

  const maxDailyTotal =
    Math.max(
      ...analytics.dailyActivity.map(
        (item) => item.total
      ),
      1
    );

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

          <p className="mt-3 text-xs font-semibold text-slate-600">
            Loading dashboard...
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
      <div className="w-full">
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-sm font-bold text-red-600">
            !
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-red-800">
              Unable to load dashboard
            </h3>

            <p className="mt-0.5 text-[11px] text-red-600">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchDashboard}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-semibold text-red-700 transition hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
            Invoice Operations
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            Overview of invoice processing activity.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDashboard}
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

        <DashboardMetric
          label="Total Invoices"
          value={totalInvoices}
          description="Invoices processed"
          type="blue"
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
                d="M15 3v5h5M9 13h6M9 17h6M9 9h2"
              />
            </svg>
          }
        />

        <DashboardMetric
          label="Successful"
          value={successfulInvoices}
          description="Processed successfully"
          type="success"
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

        <DashboardMetric
          label="Failed"
          value={failedInvoices}
          description="Require attention"
          type="danger"
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
                d="M10.3 3.8L2.9 17a2 2 0 001.75 3h14.7a2 2 0 001.75 3z"
              />
            </svg>
          }
        />

        <DashboardMetric
          label="Bulk Jobs"
          value={totalBulkJobs}
          description="Processing batches"
          type="violet"
          icon={
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
          }
        />

      </div>

      {/* =================================================
          ANALYTICS OVERVIEW
      ================================================= */}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Dashboard Analytics
            </p>

            <h2 className="mt-1 text-sm font-bold text-slate-900">
              Recent Processing Insights
            </h2>

            <p className="mt-1 text-[11px] text-slate-400">
              Calculated from the recent activity returned by the dashboard API.
            </p>
          </div>

          <span className="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
            {analytics.jobs} recent jobs
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <AnalyticsMetric
            label="Recent Volume"
            value={analytics.total}
            description="Invoices in recent activity"
            type="blue"
          />

          <AnalyticsMetric
            label="Recent Success Rate"
            value={`${analytics.recentSuccessRate}%`}
            description={`${analytics.successful.toLocaleString("en-IN")} successful`}
            type="success"
          />

          <AnalyticsMetric
            label="Recent Failure Rate"
            value={`${analytics.recentFailureRate}%`}
            description={`${analytics.failed.toLocaleString("en-IN")} failed`}
            type="danger"
          />

          <AnalyticsMetric
            label="Average / Job"
            value={analytics.averagePerJob}
            description="Invoices per recent job"
            type="violet"
          />

        </div>
      </section>

      {/* =================================================
          PERFORMANCE + BREAKDOWN
      ================================================= */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">

        {/* SUCCESS RATE */}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between gap-4">

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Processing Performance
              </p>

              <h2 className="mt-1 text-sm font-bold text-slate-900">
                Overall Success Rate
              </h2>

              <p className="mt-1 text-[11px] text-slate-400">
                Successfully processed invoices across available dashboard data.
              </p>
            </div>

            <div className="text-2xl font-bold tracking-tight text-emerald-600">
              {successRate}%
            </div>

          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">

            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${successRate}%`,
              }}
            />

          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">

            <PerformanceStat
              label="Successful"
              value={successfulInvoices}
              type="success"
            />

            <PerformanceStat
              label="Failed"
              value={failedInvoices}
              type="danger"
            />

            <PerformanceStat
              label="Duplicates"
              value={duplicateInvoices}
              type="warning"
            />

          </div>
        </section>

        {/* RECENT BREAKDOWN */}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Recent Breakdown
            </p>

            <h2 className="mt-1 text-sm font-bold text-slate-900">
              Processing Distribution
            </h2>

            <p className="mt-1 text-[11px] text-slate-400">
              Current recent activity composition.
            </p>
          </div>

          <div className="mt-5 space-y-4">

            <AnalyticsBar
              label="Successful"
              value={analytics.successful}
              total={analytics.total}
              type="success"
            />

            <AnalyticsBar
              label="Failed"
              value={analytics.failed}
              total={analytics.total}
              type="danger"
            />

            <AnalyticsBar
              label="Duplicates"
              value={analytics.duplicates}
              total={analytics.total}
              type="warning"
            />

          </div>

        </section>

      </div>

      {/* =================================================
          DAILY ACTIVITY
      ================================================= */}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Activity Trend
            </p>

            <h2 className="mt-1 text-sm font-bold text-slate-900">
              Recent Daily Volume
            </h2>

            <p className="mt-1 text-[11px] text-slate-400">
              Invoice volume grouped by processing date.
            </p>
          </div>

          {analytics.largestJob && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400">
                Largest recent job
              </p>

              <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-700">
                {analytics.largestJob.job_id}
              </p>
            </div>
          )}

        </div>

        {analytics.dailyActivity.length > 0 ? (
  <div className="mt-6">
    {/* Chart Header */}
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Invoice Volume
        </p>

        <p className="mt-1 text-sm font-medium text-slate-600">
          Recent processing activity
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />

        <span className="text-xs font-semibold text-slate-500">
          Invoices
        </span>
      </div>
    </div>

    {/* Analytics Panel */}
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Activity Cards */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(
            Math.max(analytics.dailyActivity.length, 2),
            4
          )}, minmax(0, 1fr))`,
        }}
      >
        {analytics.dailyActivity.map((item) => {
          const percentage =
            maxDailyTotal > 0
              ? Math.round((item.total / maxDailyTotal) * 100)
              : 0;

          const barHeight =
            item.total > 0
              ? Math.max(35, Math.round(percentage * 1.25))
              : 8;

          return (
            <div
              key={item.key}
              className="
                group rounded-xl border border-slate-100
                bg-slate-50/70 p-4
                transition-all duration-200
                hover:-translate-y-0.5
                hover:border-blue-100
                hover:bg-blue-50/30
                hover:shadow-sm
              "
            >
              {/* Date + Count */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Activity
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {item.label}
                  </p>
                </div>

                <div className="rounded-lg bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-100">
                  <span className="text-sm font-bold text-slate-700">
                    {item.total.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Bar Area */}
              <div className="mt-5 flex h-32 items-end justify-center">
                <div className="relative flex h-full w-full items-end justify-center">
                  {/* Bar Track */}
                  <div className="absolute bottom-0 h-full w-14 rounded-lg bg-slate-200/60" />

                  {/* Actual Bar */}
                  <div
                    className="
                      relative z-10 w-14 rounded-lg
                      bg-gradient-to-t
                      from-blue-600
                      via-blue-500
                      to-sky-400
                      shadow-sm
                      transition-all duration-500
                      group-hover:shadow-md
                    "
                    style={{
                      height: `${barHeight}px`,
                    }}
                    title={`${item.total.toLocaleString(
                      "en-IN"
                    )} invoices`}
                  />
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                <span className="text-[10px] font-medium text-slate-400">
                  Invoice volume
                </span>

                <span className="text-[10px] font-semibold text-blue-600">
                  {percentage}% peak
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
        {/* Peak Volume */}
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Peak Volume
          </p>

          <p className="mt-1 text-lg font-bold text-slate-700">
            {maxDailyTotal.toLocaleString("en-IN")}
          </p>
        </div>

        {/* Active Days */}
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Active Days
          </p>

          <p className="mt-1 text-lg font-bold text-slate-700">
            {analytics.dailyActivity.length}
          </p>
        </div>

        {/* Total Recent */}
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Total Recent
          </p>

          <p className="mt-1 text-lg font-bold text-slate-700">
            {analytics.dailyActivity
              .reduce((sum, item) => sum + item.total, 0)
              .toLocaleString("en-IN")}
          </p>
        </div>
      </div>
    </div>
  </div>
) : (
  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex min-h-[240px] items-center justify-center rounded-lg bg-slate-50">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
          <svg
            className="h-6 w-6 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3v18h18"
            />

            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16l4-5 3 3 4-6"
            />
          </svg>
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-600">
          No recent activity
        </p>

        <p className="mt-1 text-xs text-slate-400">
          Processing activity will appear here.
        </p>
      </div>
    </div>
  </div>
)}

      </section>

      {/* =================================================
          PERFORMANCE + DUPLICATES
      ================================================= */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* RECENT PERFORMANCE */}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Recent Performance
            </p>

            <h2 className="mt-1 text-sm font-bold text-slate-900">
              Processing Quality
            </h2>
          </div>

          <div className="mt-5 space-y-4">

            <QualityRow
              label="Success Rate"
              value={analytics.recentSuccessRate}
              type="success"
            />

            <QualityRow
              label="Failure Rate"
              value={analytics.recentFailureRate}
              type="danger"
            />

            <QualityRow
              label="Duplicate Rate"
              value={analytics.recentDuplicateRate}
              type="warning"
            />

          </div>

        </section>

        {/* OPERATIONAL SUMMARY */}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Operational Summary
            </p>

            <h2 className="mt-1 text-sm font-bold text-slate-900">
              Current Processing Indicators
            </h2>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">

            <OperationalStat
              label="Bulk Jobs"
              value={totalBulkJobs}
              icon="bulk"
            />

            <OperationalStat
              label="Duplicates"
              value={duplicateInvoices}
              icon="duplicate"
            />

            <OperationalStat
              label="Recent Jobs"
              value={analytics.jobs}
              icon="jobs"
            />

            <OperationalStat
              label="Avg / Job"
              value={analytics.averagePerJob}
              icon="average"
            />

          </div>

        </section>

      </div>

      {/* =================================================
          RECENT ACTIVITY
      ================================================= */}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Processing History
            </p>

            <h2 className="mt-1 text-sm font-bold text-slate-900">
              Recent Activity
            </h2>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

            {recentActivity.length} Recent
          </span>

        </div>

        <div className="overflow-x-auto">

          {recentActivity.length > 0 ? (
            <table className="w-full min-w-[760px]">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">

                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Job ID
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Processed At
                  </th>

                  <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total
                  </th>

                  <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Successful
                  </th>

                  <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Failed
                  </th>

                  <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Duplicates
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {recentActivity.map(
                  (item) => (
                    <tr
                      key={item.job_id}
                      className="transition-colors hover:bg-slate-50"
                    >

                      <td className="whitespace-nowrap px-5 py-3.5">

                        <div className="flex items-center gap-2">

                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">

                            <svg
                              className="h-3.5 w-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <rect
                                x="5"
                                y="5"
                                width="14"
                                height="14"
                                rx="2"
                              />

                              <path
                                strokeLinecap="round"
                                d="M9 9h6M9 13h6M9 17h3"
                              />
                            </svg>

                          </span>

                          <span
                            title={item.job_id}
                            className="max-w-[170px] truncate font-mono text-[11px] font-semibold text-slate-700"
                          >
                            {item.job_id}
                          </span>

                        </div>

                      </td>

                      <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-slate-500">
                        {formatDateTime(
                          item.processed_at
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-700">
                        {(
                          item.total_count ||
                          0
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-center">

                        <CountBadge
                          value={
                            item.successful_count
                          }
                          type="success"
                        />

                      </td>

                      <td className="px-5 py-3.5 text-center">

                        <CountBadge
                          value={
                            item.failed_count
                          }
                          type={
                            item.failed_count >
                            0
                              ? "danger"
                              : "neutral"
                          }
                        />

                      </td>

                      <td className="px-5 py-3.5 text-center">

                        <CountBadge
                          value={
                            item.duplicate_count
                          }
                          type={
                            item.duplicate_count >
                            0
                              ? "warning"
                              : "neutral"
                          }
                        />

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>
          ) : (
            <div className="flex min-h-[250px] flex-col items-center justify-center px-5 text-center">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">

                <svg
                  className="h-5 w-5"
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
                    d="M8 9h8M8 13h5"
                  />
                </svg>

              </div>

              <h3 className="mt-3 text-sm font-semibold text-slate-700">
                No processing activity
              </h3>

              <p className="mt-1 max-w-sm text-xs text-slate-400">
                Processing jobs will appear here after processing begins.
              </p>

            </div>
          )}

        </div>

      </section>
    </div>
  );
}

// =====================================================
// DASHBOARD METRIC
// =====================================================

interface DashboardMetricProps {
  label: string;
  value: number;
  description: string;
  type:
    | "blue"
    | "success"
    | "danger"
    | "violet";
  icon: React.ReactNode;
}

function DashboardMetric({
  label,
  value,
  description,
  type,
  icon,
}: DashboardMetricProps) {
  const styles = {
    blue: {
      icon: "bg-blue-50 text-blue-600",
    },

    success: {
      icon: "bg-emerald-50 text-emerald-600",
    },

    danger: {
      icon: "bg-red-50 text-red-600",
    },

    violet: {
      icon: "bg-violet-50 text-violet-600",
    },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">

      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${styles[type].icon}`}
      >
        {icon}
      </div>

      <p className="mt-4 text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {value.toLocaleString("en-IN")}
      </p>

      <p className="mt-1 text-[10px] text-slate-400">
        {description}
      </p>

    </div>
  );
}

// =====================================================
// ANALYTICS METRIC
// =====================================================

function AnalyticsMetric({
  label,
  value,
  description,
  type,
}: {
  label: string;
  value: number | string;
  description: string;
  type:
    | "blue"
    | "success"
    | "danger"
    | "violet";
}) {
  const styles = {
    blue: {
      wrapper:
        "border-blue-100 bg-blue-50/40",
      value: "text-blue-700",
    },

    success: {
      wrapper:
        "border-emerald-100 bg-emerald-50/40",
      value: "text-emerald-700",
    },

    danger: {
      wrapper:
        "border-red-100 bg-red-50/40",
      value: "text-red-700",
    },

    violet: {
      wrapper:
        "border-violet-100 bg-violet-50/40",
      value: "text-violet-700",
    },
  };

  return (
    <div
      className={`rounded-xl border p-4 ${styles[type].wrapper}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold tracking-tight ${styles[type].value}`}
      >
        {typeof value === "number"
          ? value.toLocaleString("en-IN")
          : value}
      </p>

      <p className="mt-1 text-[10px] text-slate-500">
        {description}
      </p>
    </div>
  );
}

// =====================================================
// PERFORMANCE STAT
// =====================================================

function PerformanceStat({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type:
    | "success"
    | "danger"
    | "warning";
}) {
  const styles = {
    success:
      "bg-emerald-50 text-emerald-700",

    danger:
      "bg-red-50 text-red-700",

    warning:
      "bg-amber-50 text-amber-700",
  };

  return (
    <div
      className={`rounded-lg px-3 py-2.5 ${styles[type]}`}
    >
      <p className="text-[10px] font-semibold opacity-70">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold">
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

// =====================================================
// ANALYTICS BAR
// =====================================================

function AnalyticsBar({
  label,
  value,
  total,
  type,
}: {
  label: string;
  value: number;
  total: number;
  type:
    | "success"
    | "danger"
    | "warning";
}) {
  const percentage =
    total > 0
      ? Math.round(
          (value / total) *
            100
        )
      : 0;

  const barStyles = {
    success: "bg-emerald-500",
    danger: "bg-red-500",
    warning: "bg-amber-500",
  };

  return (
    <div>

      <div className="flex items-center justify-between gap-3">

        <span className="text-xs font-semibold text-slate-600">
          {label}
        </span>

        <span className="text-[11px] font-bold text-slate-700">
          {value.toLocaleString(
            "en-IN"
          )}{" "}
          <span className="font-medium text-slate-400">
            ({percentage}%)
          </span>
        </span>

      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">

        <div
          className={`h-full rounded-full transition-all duration-500 ${barStyles[type]}`}
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}

// =====================================================
// QUALITY ROW
// =====================================================

function QualityRow({
  label,
  value,
  type,
}: {
  label: string;
  value: number;
  type:
    | "success"
    | "danger"
    | "warning";
}) {
  const barStyles = {
    success: "bg-emerald-500",
    danger: "bg-red-500",
    warning: "bg-amber-500",
  };

  const textStyles = {
    success: "text-emerald-700",
    danger: "text-red-700",
    warning: "text-amber-700",
  };

  return (
    <div>

      <div className="flex items-center justify-between">

        <span className="text-xs font-medium text-slate-600">
          {label}
        </span>

        <span
          className={`text-xs font-bold ${textStyles[type]}`}
        >
          {value}%
        </span>

      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">

        <div
          className={`h-full rounded-full transition-all duration-500 ${barStyles[type]}`}
          style={{
            width: `${Math.min(
              100,
              Math.max(0, value)
            )}%`,
          }}
        />

      </div>

    </div>
  );
}

// =====================================================
// OPERATIONAL STAT
// =====================================================

function OperationalStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon:
    | "bulk"
    | "duplicate"
    | "jobs"
    | "average";
}) {
  const icons = {
    bulk: (
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
    ),

    duplicate: (
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
    ),

    jobs: (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle
          cx="12"
          cy="12"
          r="8"
        />

        <path
          strokeLinecap="round"
          d="M12 8v4l2.5 2.5"
        />
      </svg>
    ),

    average: (
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
          d="M5 19V5M5 19h14"
        />

        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 15l3-4 3 2 4-6"
        />
      </svg>
    ),
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
        {icons[icon]}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-400">
          {label}
        </p>

        <p className="mt-0.5 text-sm font-bold text-slate-800">
          {value.toLocaleString(
            "en-IN"
          )}
        </p>
      </div>

    </div>
  );
}

// =====================================================
// LEGEND
// =====================================================

function Legend({
  label,
  type,
}: {
  label: string;
  type:
    | "success"
    | "danger"
    | "warning";
}) {
  const styles = {
    success: "bg-emerald-500",
    danger: "bg-red-400",
    warning: "bg-amber-400",
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500">

      <span
        className={`h-2 w-2 rounded-full ${styles[type]}`}
      />

      {label}

    </span>
  );
}

// =====================================================
// COUNT BADGE
// =====================================================

interface CountBadgeProps {
  value: number;
  type:
    | "success"
    | "danger"
    | "warning"
    | "neutral";
}

function CountBadge({
  value,
  type,
}: CountBadgeProps) {
  const styles = {
    success:
      "bg-emerald-50 text-emerald-700",

    danger:
      "bg-red-50 text-red-700",

    warning:
      "bg-amber-50 text-amber-700",

    neutral:
      "bg-slate-50 text-slate-500",
  };

  return (
    <span
      className={`inline-flex min-w-8 items-center justify-center rounded-md px-2 py-1 text-[10px] font-bold ${styles[type]}`}
    >
      {(value || 0).toLocaleString(
        "en-IN"
      )}
    </span>
  );
}

export default Dashboard;