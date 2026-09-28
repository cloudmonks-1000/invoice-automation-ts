"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface UserMetrics {
  total_users?: number | null;
  active_users?: number | null;
  inactive_users?: number | null;
  admin_users?: number | null;
}

interface JobProcessingMetrics {
  processing?: number | null;
  completed?: number | null;
  partial?: number | null;
  failed?: number | null;
}

interface JobMetrics {
  total_jobs?: number | null;
  processing?: JobProcessingMetrics | null;
}

interface InvoiceMetrics {
  total_invoices?: number | null;
  successful_invoices?: number | null;
  failed_invoices?: number | null;
  total_files?: number | null;
}

interface DashboardMetrics {
  users?: UserMetrics | null;
  jobs?: JobMetrics | null;
  invoices?: InvoiceMetrics | null;
}

interface RecentJob {
  record_id?: number | null;
  RECORD_ID?: number | null;
  job_id?: string | null;
  JOB_ID?: string | null;
  full_name?: string | null;
  FULL_NAME?: string | null;
  email?: string | null;
  EMAIL?: string | null;
  source_file_name?: string | null;
  SOURCE_FILE_NAME?: string | null;
  total_invoices?: number | null;
  TOTAL_INVOICES?: number | null;
  successful_invoices?: number | null;
  SUCCESSFUL_INVOICES?: number | null;
  total_files?: number | null;
  TOTAL_FILES?: number | null;
  status?: string | null;
  STATUS?: string | null;
  started_at?: string | null;
  STARTED_AT?: string | null;
}

interface RecentUser {
  user_id?: number | null;
  USER_ID?: number | null;
  full_name?: string | null;
  FULL_NAME?: string | null;
  email?: string | null;
  EMAIL?: string | null;
  role?: string | null;
  ROLE?: string | null;
  status?: string | null;
  STATUS?: string | null;
}

interface DashboardData {
  metrics?: DashboardMetrics | null;
  recentJobs?: RecentJob[];
  recentUsers?: RecentUser[];
  message?: string;
}

interface TableHeadProps {
  children: ReactNode;
  center?: boolean;
}

interface MetricCardProps {
  label: string;
  value?: number | null;
  helper: string;
  icon: string;
  loading: boolean;
}

type StatusMetricType =
  | "processing"
  | "completed"
  | "partial"
  | "failed";

interface StatusMetricProps {
  label: string;
  value: number;
  type: StatusMetricType;
}

interface OverviewRowProps {
  label: string;
  value?: number | null;
}

interface StatusBadgeProps {
  status?: string | null;
}

interface RoleBadgeProps {
  role: string;
}

export default function AdminDashboard() {
  const [data, setData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  async function loadDashboard(): Promise<void> {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/dashboard",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result: DashboardData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Failed to load dashboard"
        );
      }

      setData(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const metrics = data?.metrics;

  const jobStats = useMemo(
    () => ({
      processing: Number(
        metrics?.jobs?.processing
          ?.processing || 0
      ),
      completed: Number(
        metrics?.jobs?.processing
          ?.completed || 0
      ),
      partial: Number(
        metrics?.jobs?.processing
          ?.partial || 0
      ),
      failed: Number(
        metrics?.jobs?.processing
          ?.failed || 0
      ),
    }),
    [metrics]
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Administration
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Dashboard Overview
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Monitor users, invoice processing and
            system activity.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            className={`h-3.5 w-3.5 ${
              loading ? "animate-spin" : ""
            }`}
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

          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          <p className="font-semibold">
            Dashboard loading failed
          </p>

          <p className="mt-1">{error}</p>

          <button
            type="button"
            onClick={loadDashboard}
            className="mt-2 rounded-md bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Primary Metrics */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Users"
          value={
            metrics?.users?.total_users
          }
          helper={`${metrics?.users?.active_users || 0} active users`}
          icon="U"
          loading={loading}
        />

        <MetricCard
          label="Total Processing Jobs"
          value={
            metrics?.jobs?.total_jobs
          }
          helper={`${jobStats.processing} currently processing`}
          icon="J"
          loading={loading}
        />

        <MetricCard
          label="Invoices Processed"
          value={
            metrics?.invoices?.total_invoices
          }
          helper={`${metrics?.invoices?.successful_invoices || 0} successful`}
          icon="I"
          loading={loading}
        />

        <MetricCard
          label="Files Processed"
          value={
            metrics?.invoices?.total_files
          }
          helper={`${metrics?.invoices?.failed_invoices || 0} invoice failures`}
          icon="F"
          loading={loading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* Processing Overview */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Processing Overview
            </h3>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Current processing job distribution.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatusMetric
              label="Processing"
              value={jobStats.processing}
              type="processing"
            />

            <StatusMetric
              label="Completed"
              value={jobStats.completed}
              type="completed"
            />

            <StatusMetric
              label="Partial"
              value={jobStats.partial}
              type="partial"
            />

            <StatusMetric
              label="Failed"
              value={jobStats.failed}
              type="failed"
            />
          </div>
        </section>

        {/* User Overview */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              User Overview
            </h3>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Application account summary.
            </p>
          </div>

          <div className="space-y-3">
            <OverviewRow
              label="Total Users"
              value={
                metrics?.users?.total_users
              }
            />

            <OverviewRow
              label="Active Users"
              value={
                metrics?.users?.active_users
              }
            />

            <OverviewRow
              label="Inactive Users"
              value={
                metrics?.users?.inactive_users
              }
            />

            <OverviewRow
              label="Administrators"
              value={
                metrics?.users?.admin_users
              }
            />
          </div>
        </section>
      </div>

      {/* Recent Jobs */}
      <section className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Recent Processing Jobs
            </h3>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Latest invoice processing activity.
            </p>
          </div>

          <a
            href="/admin/processing"
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
          >
            View all →
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <TableHead>Job</TableHead>
                <TableHead>User</TableHead>

                <TableHead center>
                  Invoices
                </TableHead>

                <TableHead center>
                  Files
                </TableHead>

                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

                      <p className="mt-2 text-xs text-slate-500">
                        Loading dashboard...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : data?.recentJobs?.length ? (
                data.recentJobs.map(
                  (job, index) => {
                    const fullName =
                      job.full_name ||
                      job.FULL_NAME ||
                      "Unknown User";

                    const email =
                      job.email ||
                      job.EMAIL ||
                      "—";

                    return (
                      <tr
                        key={
                          job.record_id ??
                          job.RECORD_ID ??
                          job.job_id ??
                          job.JOB_ID ??
                          index
                        }
                        className="transition hover:bg-slate-50"
                      >
                        {/* Job */}
                        <td className="px-5 py-3.5">
                          <p className="font-mono text-[11px] font-semibold text-slate-900">
                            {job.job_id ||
                              job.JOB_ID ||
                              "—"}
                          </p>

                          <p className="mt-0.5 max-w-[210px] truncate text-[10px] text-slate-400">
                            {job.source_file_name ||
                              job.SOURCE_FILE_NAME ||
                              "—"}
                          </p>
                        </td>

                        {/* User */}
                        <td className="px-5 py-3.5">
                          <p className="text-xs font-semibold text-slate-800">
                            {fullName}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {email}
                          </p>
                        </td>

                        {/* Invoices */}
                        <td className="px-5 py-3.5 text-center">
                          <p className="text-xs font-semibold text-slate-900">
                            {job.total_invoices ??
                              job.TOTAL_INVOICES ??
                              0}
                          </p>

                          <p className="mt-0.5 text-[10px] text-emerald-600">
                            {job.successful_invoices ??
                              job.SUCCESSFUL_INVOICES ??
                              0}{" "}
                            successful
                          </p>
                        </td>

                        {/* Files */}
                        <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-700">
                          {job.total_files ??
                            job.TOTAL_FILES ??
                            0}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <StatusBadge
                            status={
                              job.status ||
                              job.STATUS
                            }
                          />
                        </td>

                        {/* Started */}
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                          {formatDate(
                            job.started_at ||
                              job.STARTED_AT
                          )}
                        </td>
                      </tr>
                    );
                  }
                )
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-xs text-slate-500"
                  >
                    No processing jobs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Users */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Recently Added Users
            </h3>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Latest application accounts.
            </p>
          </div>

          <a
            href="/admin/users"
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
          >
            Manage users →
          </a>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              Loading users...
            </div>
          ) : data?.recentUsers?.length ? (
            data.recentUsers.map(
              (user, index) => {
                const userId =
                  user.user_id ??
                  user.USER_ID ??
                  index;

                const fullName =
                  user.full_name ||
                  user.FULL_NAME ||
                  "Unnamed User";

                const email =
                  user.email ||
                  user.EMAIL ||
                  "—";

                const role =
                  user.role ||
                  user.ROLE ||
                  "USER";

                const status =
                  user.status ||
                  user.STATUS ||
                  "UNKNOWN";

                return (
                  <div
                    key={userId}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                        {(
                          fullName ||
                          email ||
                          "U"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {fullName}
                        </p>

                        <p className="truncate text-[10px] text-slate-500">
                          {email}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <RoleBadge role={role} />

                      <StatusBadge
                        status={status}
                      />
                    </div>
                  </div>
                );
              }
            )
          ) : (
            <div className="px-5 py-10 text-center text-xs text-slate-500">
              No users found.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TableHead({
  children,
  center = false,
}: TableHeadProps) {
  return (
    <th
      className={`px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
        center
          ? "text-center"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  loading,
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">
          {label}
        </p>

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-700">
          {icon}
        </div>
      </div>

      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {loading
          ? "—"
          : formatNumber(value)}
      </p>

      <p className="mt-0.5 text-[10px] text-slate-400">
        {helper}
      </p>
    </div>
  );
}

function StatusMetric({
  label,
  value,
  type,
}: StatusMetricProps) {
  const styles: Record<
    StatusMetricType,
    string
  > = {
    processing:
      "bg-amber-50 text-amber-700",
    completed:
      "bg-emerald-50 text-emerald-700",
    partial:
      "bg-blue-50 text-blue-700",
    failed:
      "bg-red-50 text-red-700",
  };

  return (
    <div
      className={`rounded-lg p-3 ${
        styles[type] ||
        "bg-slate-50 text-slate-700"
      }`}
    >
      <p className="text-[11px] font-medium opacity-80">
        {label}
      </p>

      <p className="mt-1.5 text-xl font-bold">
        {formatNumber(value)}
      </p>
    </div>
  );
}

function OverviewRow({
  label,
  value,
}: OverviewRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-xs font-bold text-slate-900">
        {formatNumber(value)}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
}: StatusBadgeProps) {
  const styles: Record<
    string,
    string
  > = {
    PROCESSING:
      "bg-amber-100 text-amber-700",
    COMPLETED:
      "bg-emerald-100 text-emerald-700",
    PARTIAL:
      "bg-blue-100 text-blue-700",
    FAILED:
      "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        styles[status || ""] ||
        "bg-slate-100 text-slate-700"
      }`}
    >
      {status || "UNKNOWN"}
    </span>
  );
}

function RoleBadge({
  role,
}: RoleBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
        role === "ADMIN"
          ? "bg-violet-100 text-violet-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {role}
    </span>
  );
}

function formatNumber(
  value: number | null | undefined
): string {
  return Number(
    value || 0
  ).toLocaleString("en-IN");
}

function formatDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}