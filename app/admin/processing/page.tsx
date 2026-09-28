"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

interface ProcessingRecord {
  record_id: number;
  job_id: string | null;
  user_id: number | null;
  full_name: string | null;
  email: string | null;
  source_file_name: string | null;
  source_file_type: string | null;
  total_invoices: number | null;
  successful_invoices: number | null;
  failed_invoices: number | null;
  duplicate_invoices: number | null;
  total_files: number | null;
  status: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
}

interface ProcessingResponse {
  records?: ProcessingRecord[];
  message?: string;
}

type StatusFilter =
  | "ALL"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

interface StatusBadgeProps {
  status: string | null;
}

export default function ProcessingPage() {
  const [records, setRecords] = useState<ProcessingRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecords(): Promise<void> {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/processing", {
        method: "GET",
        cache: "no-store",
      });

      const data: ProcessingResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to load processing records"
        );
      }

      setRecords(data.records || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load processing records"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        record.status === statusFilter;

      if (!matchesStatus) return false;
      if (!query) return true;

      return [
        record.job_id,
        record.source_file_name,
        record.full_name,
        record.email,
        record.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    });
  }, [records, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: records.length,
      processing: records.filter(
        (record) => record.status === "PROCESSING"
      ).length,
      completed: records.filter(
        (record) => record.status === "COMPLETED"
      ).length,
      failed: records.filter(
        (record) => record.status === "FAILED"
      ).length,
    }),
    [records]
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />

            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-600">
              Operations
            </p>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Processing Monitor
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            Monitor invoice processing jobs across the application.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRecords}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-100 text-sm font-bold text-red-600">
            !
          </div>

          <div>
            <p className="text-xs font-semibold text-red-800">
              Unable to load processing jobs
            </p>

            <p className="mt-1 text-xs text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={loadRecords}
              className="mt-2 rounded-md bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Jobs"
          value={stats.total}
          badge="All"
          iconClass="bg-blue-50 text-blue-600"
          icon={
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="4" y="4" width="16" height="16" rx="3" />
              <path
                strokeLinecap="round"
                d="M8 9h8M8 13h8M8 17h5"
              />
            </svg>
          }
        />

        <StatCard
          label="Processing"
          value={stats.processing}
          badge="Active"
          iconClass="bg-amber-50 text-amber-600"
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
                d="M12 6v6l4 2"
              />
              <circle cx="12" cy="12" r="8" />
            </svg>
          }
        />

        <StatCard
          label="Completed"
          value={stats.completed}
          badge="Success"
          iconClass="bg-emerald-50 text-emerald-600"
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

        <StatCard
          label="Failed"
          value={stats.failed}
          badge="Attention"
          iconClass="bg-red-50 text-red-600"
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
      </div>

      {/* Table Card */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Processing Jobs
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filteredRecords.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {records.length}
              </span>{" "}
              jobs
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path
                  strokeLinecap="round"
                  d="M20 20l-4-4"
                />
              </svg>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search job, file, user..."
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Filter */}
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter
                )
              }
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="ALL">All Status</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="PARTIAL">Partial</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <TableHead>Job</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Source File</TableHead>
                <TableHead center>Invoices</TableHead>
                <TableHead center>Files</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <div className="flex flex-col items-center">
                      <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Loading processing jobs...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
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
                          d="M8 9h8M8 13h5"
                        />
                      </svg>
                    </div>

                    <p className="mt-3 text-xs font-semibold text-slate-800">
                      No processing jobs found
                    </p>

                    <p className="mt-1 text-[11px] text-slate-400">
                      Try changing your search or status filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr
                    key={record.record_id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    {/* Job */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
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
                        </div>

                        <div>
                          <p
                            className="max-w-[170px] truncate font-mono text-[11px] font-bold text-slate-800"
                            title={record.job_id || ""}
                          >
                            {record.job_id || "—"}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            ID #{record.record_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {getInitials(record.full_name)}
                        </div>

                        <div>
                          <p className="max-w-[160px] truncate text-xs font-semibold text-slate-800">
                            {record.full_name || "Unknown User"}
                          </p>

                          <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-slate-500">
                            {record.email || "—"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="max-w-[230px] px-5 py-3.5">
                      <p
                        className="truncate text-xs font-medium text-slate-700"
                        title={record.source_file_name || ""}
                      >
                        {record.source_file_name || "—"}
                      </p>

                      <div className="mt-1">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                          {record.source_file_type || "Unknown"}
                        </span>
                      </div>
                    </td>

                    {/* Invoices */}
                    <td className="px-5 py-3.5 text-center">
                      <p className="text-xs font-bold text-slate-900">
                        {(record.total_invoices ?? 0).toLocaleString(
                          "en-IN"
                        )}
                      </p>

                      <div className="mt-1 flex items-center justify-center gap-1 text-[10px]">
                        <span className="font-medium text-emerald-600">
                          {record.successful_invoices ?? 0} success
                        </span>

                        <span className="text-slate-300">•</span>

                        <span className="font-medium text-red-500">
                          {record.failed_invoices ?? 0} failed
                        </span>
                      </div>
                    </td>

                    {/* Files */}
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {record.total_files ?? 0}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={record.status} />
                    </td>

                    {/* Started */}
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <p className="text-xs text-slate-600">
                        {formatDate(record.started_at)}
                      </p>

                      {record.completed_at && (
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Completed{" "}
                          {formatDate(record.completed_at)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface TableHeadProps {
  children: ReactNode;
  center?: boolean;
}

function TableHead({
  children,
  center = false,
}: TableHeadProps) {
  return (
    <th
      className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${
        center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  iconClass: string;
  badge: string;
}

function StatCard({
  label,
  value,
  icon,
  iconClass,
  badge,
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </div>

        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          {badge}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value.toLocaleString("en-IN")}
      </p>

      <p className="mt-0.5 text-xs font-medium text-slate-500">
        {label}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: StatusBadgeProps) {
  const normalizedStatus = status || "UNKNOWN";

  const styles: Record<
    string,
    {
      container: string;
      dot: string;
    }
  > = {
    PROCESSING: {
      container: "bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    },
    COMPLETED: {
      container: "bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },
    PARTIAL: {
      container: "bg-blue-50 text-blue-700",
      dot: "bg-blue-500",
    },
    FAILED: {
      container: "bg-red-50 text-red-700",
      dot: "bg-red-500",
    },
    UNKNOWN: {
      container: "bg-slate-100 text-slate-600",
      dot: "bg-slate-400",
    },
  };

  const style =
    styles[normalizedStatus] || styles.UNKNOWN;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${style.container}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
      />

      {normalizedStatus}
    </span>
  );
}

function getInitials(name: string | null): string {
  if (!name) return "U";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

function formatDate(
  value: string | null | undefined
): string {
  if (!value) return "—";

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