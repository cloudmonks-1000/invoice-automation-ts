"use client";

import {
  useEffect,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";

const API_URL = "";

const DEFAULT_LIMIT = 25;

interface HistoryItem {
  record_id?: number;
  job_id: string;

  source_file_name: string | null;
  source_file_type: string | null;

  processing_type: "BULK" | "SINGLE";
  voucher_number: string | null;

  processed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at?: string | null;

  total_count: number;
  successful_count: number;
  failed_count: number;
  duplicate_count: number;
  total_files: number;

  status: string;
  error_message: string | null;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface HistoryResponse {
  success?: boolean;
  history?: HistoryItem[];
  pagination?: PaginationData;
  filters?: {
    search: string;
    type: string;
    status: string;
    from: string | null;
    to: string | null;
  };
  message?: string;
}

type HistoryType =
  | "ALL"
  | "SINGLE"
  | "BULK";

type HistoryStatus =
  | "ALL"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "PROCESSING";

function History() {
  const [history, setHistory] =
    useState<HistoryItem[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const [exporting, setExporting] =
    useState<boolean>(false);

  // =====================================================
  // FILTER STATE
  // =====================================================

  const [searchInput, setSearchInput] =
    useState<string>("");

  const [search, setSearch] =
    useState<string>("");

  const [type, setType] =
    useState<HistoryType>("ALL");

  const [status, setStatus] =
    useState<HistoryStatus>("ALL");

  const [fromDateInput, setFromDateInput] =
    useState<string>("");

  const [toDateInput, setToDateInput] =
    useState<string>("");

  const [fromDate, setFromDate] =
    useState<string>("");

  const [toDate, setToDate] =
    useState<string>("");

  // =====================================================
  // PAGINATION STATE
  // =====================================================

  const [page, setPage] =
    useState<number>(1);

  const [limit, setLimit] =
    useState<number>(DEFAULT_LIMIT);

  const [pagination, setPagination] =
    useState<PaginationData>({
      page: 1,
      limit: DEFAULT_LIMIT,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

  // =====================================================
  // JOB DETAILS STATE
  // =====================================================

  const [selectedJob, setSelectedJob] =
    useState<HistoryItem | null>(null);

  // =====================================================
  // FETCH HISTORY
  // =====================================================

  const fetchHistory = async (
    currentPage: number = page,
    currentLimit: number = limit,
    currentSearch: string = search,
    currentType: HistoryType = type,
    currentStatus: HistoryStatus = status,
    currentFromDate: string = fromDate,
    currentToDate: string = toDate
  ): Promise<void> => {
    try {
      setLoading(true);
      setError("");

      const params =
        new URLSearchParams();

      params.set(
        "page",
        String(currentPage)
      );

      params.set(
        "limit",
        String(currentLimit)
      );

      if (currentSearch.trim()) {
        params.set(
          "search",
          currentSearch.trim()
        );
      }

      if (currentType !== "ALL") {
        params.set(
          "type",
          currentType
        );
      }

      if (currentStatus !== "ALL") {
        params.set(
          "status",
          currentStatus
        );
      }

      if (currentFromDate) {
        params.set(
          "from",
          currentFromDate
        );
      }

      if (currentToDate) {
        params.set(
          "to",
          currentToDate
        );
      }

      const url =
        `${API_URL}/api/history?${params.toString()}`;

      const response =
        await fetch(url, {
          cache: "no-store",
        });

      if (!response.ok) {
        throw new Error(
          "Failed to fetch processing history"
        );
      }

      const data: HistoryResponse =
        await response.json();

      setHistory(
        data.history || []
      );

      if (data.pagination) {
        setPagination(
          data.pagination
        );

        setPage(
          data.pagination.page
        );

        setLimit(
          data.pagination.limit
        );
      } else {
        setPagination({
          page: currentPage,
          limit: currentLimit,
          total:
            data.history?.length || 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage:
            currentPage > 1,
        });
      }
    } catch (err: unknown) {
      console.error(
        "History error:",
        err
      );

      setError(
        "Unable to load processing history."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    fetchHistory(
      1,
      DEFAULT_LIMIT,
      "",
      "ALL",
      "ALL",
      "",
      ""
    );

    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =====================================================
  // APPLY FILTERS
  // =====================================================

  const handleApplyFilters =
    (): void => {
      const nextSearch =
        searchInput.trim();

      if (
        fromDateInput &&
        toDateInput &&
        fromDateInput > toDateInput
      ) {
        setError(
          "From date cannot be after to date."
        );

        return;
      }

      setSearch(nextSearch);
      setFromDate(fromDateInput);
      setToDate(toDateInput);
      setPage(1);

      fetchHistory(
        1,
        limit,
        nextSearch,
        type,
        status,
        fromDateInput,
        toDateInput
      );
    };

  // =====================================================
  // RESET FILTERS
  // =====================================================

  const handleResetFilters =
    (): void => {
      setSearchInput("");
      setSearch("");
      setType("ALL");
      setStatus("ALL");

      setFromDateInput("");
      setToDateInput("");

      setFromDate("");
      setToDate("");

      setPage(1);
      setError("");

      fetchHistory(
        1,
        limit,
        "",
        "ALL",
        "ALL",
        "",
        ""
      );
    };

  // =====================================================
  // SEARCH ENTER
  // =====================================================

  const handleSearchKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === "Enter") {
      handleApplyFilters();
    }
  };

  // =====================================================
  // PAGE CHANGE
  // =====================================================

  const handlePageChange = (
    nextPage: number
  ): void => {
    if (loading) {
      return;
    }

    if (nextPage < 1) {
      return;
    }

    if (
      pagination.totalPages > 0 &&
      nextPage > pagination.totalPages
    ) {
      return;
    }

    setPage(nextPage);

    fetchHistory(
      nextPage,
      limit,
      search,
      type,
      status,
      fromDate,
      toDate
    );
  };

  // =====================================================
  // LIMIT CHANGE
  // =====================================================

  const handleLimitChange = (
    nextLimit: number
  ): void => {
    setLimit(nextLimit);
    setPage(1);

    fetchHistory(
      1,
      nextLimit,
      search,
      type,
      status,
      fromDate,
      toDate
    );
  };

  // =====================================================
  // REFRESH
  // =====================================================

  const handleRefresh =
    (): void => {
      fetchHistory(
        page,
        limit,
        search,
        type,
        status,
        fromDate,
        toDate
      );
    };

  // =====================================================
  // EXPORT HISTORY
  // =====================================================

  const handleExport = async (): Promise<void> => {
    try {
      setExporting(true);
      setError("");

      const params =
        new URLSearchParams();

      /*
       * IMPORTANT:
       * Export uses currently applied filters,
       * not the un-applied input values.
       */

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      if (type !== "ALL") {
        params.set(
          "type",
          type
        );
      }

      if (status !== "ALL") {
        params.set(
          "status",
          status
        );
      }

      if (fromDate) {
        params.set(
          "from",
          fromDate
        );
      }

      if (toDate) {
        params.set(
          "to",
          toDate
        );
      }

      const queryString =
        params.toString();

      const url =
        queryString
          ? `${API_URL}/api/history/export?${queryString}`
          : `${API_URL}/api/history/export`;

      const response =
        await fetch(url, {
          method: "GET",
          cache: "no-store",
        });

      if (!response.ok) {
        let message =
          "Failed to export processing history.";

        try {
          const data =
            await response.json();

          if (
            data?.message &&
            typeof data.message === "string"
          ) {
            message = data.message;
          }
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }

      const blob =
        await response.blob();

      const contentDisposition =
        response.headers.get(
          "Content-Disposition"
        );

      let filename =
        "processing-history.csv";

      /*
       * Supports:
       * filename="processing-history-2026-09-23.csv"
       */

      const filenameMatch =
        contentDisposition?.match(
          /filename="([^"]+)"/i
        );

      if (filenameMatch?.[1]) {
        filename =
          filenameMatch[1];
      }

      const downloadUrl =
        window.URL.createObjectURL(
          blob
        );

      const anchor =
        document.createElement("a");

      anchor.href =
        downloadUrl;

      anchor.download =
        filename;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );
    } catch (err: unknown) {
      console.error(
        "History export error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to export processing history."
      );
    } finally {
      setExporting(false);
    }
  };

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (
    dateString:
      | string
      | null
      | undefined
  ): string => {
    if (!dateString) {
      return "-";
    }

    const date =
      new Date(dateString);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return dateString;
    }

    return date.toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  };

  // =====================================================
  // STATUS LABEL
  // =====================================================

  const getStatus = (
    item: HistoryItem
  ): string => {
    if (
      item.status ===
      "PROCESSING"
    ) {
      return "Processing";
    }

    if (
      item.status ===
      "FAILED"
    ) {
      return "Failed";
    }

    if (
      item.status ===
        "PARTIAL" ||
      item.failed_count > 0
    ) {
      return "Completed with Errors";
    }

    return "Completed";
  };

  // =====================================================
  // STATUS STYLE
  // =====================================================

  const getStatusStyle = (
    item: HistoryItem
  ): string => {
    if (
      item.status ===
      "PROCESSING"
    ) {
      return "bg-blue-50 text-blue-700";
    }

    if (
      item.status ===
      "FAILED"
    ) {
      return "bg-red-50 text-red-700";
    }

    if (
      item.status ===
        "PARTIAL" ||
      item.failed_count > 0
    ) {
      return "bg-amber-50 text-amber-700";
    }

    return "bg-emerald-50 text-emerald-700";
  };

  // =====================================================
  // STATUS DOT
  // =====================================================

  const getStatusDotStyle = (
    item: HistoryItem
  ): string => {
    if (
      item.status ===
      "PROCESSING"
    ) {
      return "bg-blue-500";
    }

    if (
      item.status ===
      "FAILED"
    ) {
      return "bg-red-500";
    }

    if (
      item.status ===
        "PARTIAL" ||
      item.failed_count > 0
    ) {
      return "bg-amber-500";
    }

    return "bg-emerald-500";
  };

  // =====================================================
  // SUMMARY
  // =====================================================

  const totalJobs =
    pagination.total;

  const totalSuccessful =
    history.reduce(
      (sum, item) =>
        sum +
        (item.successful_count ||
          0),
      0
    );

  const totalFailed =
    history.reduce(
      (sum, item) =>
        sum +
        (item.failed_count ||
          0),
      0
    );

  const totalDuplicates =
    history.reduce(
      (sum, item) =>
        sum +
        (item.duplicate_count ||
          0),
      0
    );

  const singleJobs =
    history.filter(
      (item) =>
        item.processing_type ===
        "SINGLE"
    ).length;

  const bulkJobs =
    history.filter(
      (item) =>
        item.processing_type ===
        "BULK"
    ).length;

  // =====================================================
  // PAGINATION RANGE
  // =====================================================

  const getPageNumbers =
    (): (number | "...")[] => {
      const totalPages =
        pagination.totalPages;

      if (totalPages <= 7) {
        return Array.from(
          {
            length: totalPages,
          },
          (_, index) =>
            index + 1
        );
      }

      const currentPage =
        pagination.page;

      if (currentPage <= 4) {
        return [
          1,
          2,
          3,
          4,
          5,
          "...",
          totalPages,
        ];
      }

      if (
        currentPage >=
        totalPages - 3
      ) {
        return [
          1,
          "...",
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      }

      return [
        1,
        "...",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "...",
        totalPages,
      ];
    };

  const pageNumbers =
    getPageNumbers();

  // =====================================================
  // JOB DETAILS MODAL
  // =====================================================

  useEffect(() => {
    const handleEscape = (
      event: globalThis.KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setSelectedJob(null);
      }
    };

    if (selectedJob) {
      document.addEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow =
        "hidden";
    }

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow =
        "";
    };
  }, [selectedJob]);

  const getDetailStatusStyle = (
    item: HistoryItem
  ): string => {
    if (item.status === "PROCESSING") {
      return "border-blue-200 bg-blue-50 text-blue-700";
    }

    if (item.status === "FAILED") {
      return "border-red-200 bg-red-50 text-red-700";
    }

    if (
      item.status === "PARTIAL" ||
      item.failed_count > 0
    ) {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }

    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  };

  const getDetailTypeLabel = (
    type: HistoryItem["processing_type"]
  ): string => {
    return type === "SINGLE"
      ? "Single Voucher"
      : "Bulk Processing";
  };

  const showingFrom =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) *
          pagination.limit +
        1;

  const showingTo =
    Math.min(
      pagination.page *
        pagination.limit,
      pagination.total
    );

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="w-full">

      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
            Operations
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Processing History
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            Review previous invoice
            processing activity.
          </p>
        </div>

        <div className="flex items-center gap-2">

          {/* Export CSV */}

          <button
            type="button"
            onClick={handleExport}
            disabled={
              loading ||
              exporting
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    className="opacity-25"
                  />

                  <path
                    d="M21 12a9 9 0 00-9-9"
                    strokeLinecap="round"
                  />
                </svg>

                Exporting...
              </>
            ) : (
              <>
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v12"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 10l5 5 5-5"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 21h14"
                  />
                </svg>

                Export CSV
              </>
            )}
          </button>

          {/* Refresh */}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={
              loading ||
              exporting
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${
                loading
                  ? "animate-spin"
                  : ""
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

            Refresh
          </button>
        </div>
      </div>

      {/* =================================================
          SUMMARY CARDS
      ================================================= */}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <HistoryMetric
          label="Total Jobs"
          value={totalJobs}
          description={`${singleJobs} single · ${bulkJobs} bulk on this page`}
          type="neutral"
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

        <HistoryMetric
          label="Successful"
          value={totalSuccessful}
          description="Current page"
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

        <HistoryMetric
          label="Failed"
          value={totalFailed}
          description="Current page"
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
                d="M10.3 3.8L2.9 17a2 2 0 001.75 3h14.7a2 2 0 001.75 3L13.7 3.8a2 2 0 00-3.4 0z"
              />
            </svg>
          }
        />

        <HistoryMetric
          label="Duplicates"
          value={totalDuplicates}
          description="Current page"
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
          SEARCH + FILTERS
      ================================================= */}

      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-900">
            Search & Filters
          </h2>

          <p className="mt-0.5 text-[11px] text-slate-400">
            Search by job ID, voucher,
            file or processing date.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1fr)_145px_165px_150px_150px]">

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6"
                />

                <path
                  strokeLinecap="round"
                  d="M16 16l4 4"
                />
              </svg>
            </span>

            <input
              type="text"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  event.target.value
                )
              }
              onKeyDown={
                handleSearchKeyDown
              }
              placeholder="Search job, voucher or file"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={type}
            onChange={(event) =>
              setType(
                event.target
                  .value as HistoryType
              )
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">
              All Types
            </option>

            <option value="SINGLE">
              Single Voucher
            </option>

            <option value="BULK">
              Bulk Processing
            </option>
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target
                  .value as HistoryStatus
              )
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">
              All Status
            </option>

            <option value="COMPLETED">
              Completed
            </option>

            <option value="PARTIAL">
              Completed with Errors
            </option>

            <option value="FAILED">
              Failed
            </option>

            <option value="PROCESSING">
              Processing
            </option>
          </select>

          <input
            type="date"
            value={fromDateInput}
            onChange={(event) =>
              setFromDateInput(
                event.target.value
              )
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />

          <input
            type="date"
            value={toDateInput}
            onChange={(event) =>
              setToDateInput(
                event.target.value
              )
            }
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={
              handleApplyFilters
            }
            disabled={loading}
            className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply Filters
          </button>

          <button
            type="button"
            onClick={
              handleResetFilters
            }
            disabled={loading}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          {(search ||
            type !== "ALL" ||
            status !== "ALL" ||
            fromDate ||
            toDate) && (
            <span className="ml-1 text-[10px] font-medium text-slate-400">
              Filters applied
            </span>
          )}
        </div>

        {(search ||
          type !== "ALL" ||
          status !== "ALL" ||
          fromDate ||
          toDate) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">

            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Active:
            </span>

            {search && (
              <span className="max-w-full truncate rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                Search: {search}
              </span>
            )}

            {type !== "ALL" && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                Type:{" "}
                {type ===
                "SINGLE"
                  ? "Single"
                  : "Bulk"}
              </span>
            )}

            {status !== "ALL" && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                Status:{" "}
                {status ===
                "PARTIAL"
                  ? "Completed with Errors"
                  : status}
              </span>
            )}

            {fromDate && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                From: {fromDate}
              </span>
            )}

            {toDate && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                To: {toDate}
              </span>
            )}
          </div>
        )}
      </section>

      {/* =================================================
          HISTORY TABLE
      ================================================= */}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Processing Jobs
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-400">
              Single voucher and bulk
              invoice processing activity.
            </p>
          </div>

          {!loading &&
            !error && (
              <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                {pagination.total.toLocaleString(
                  "en-IN"
                )}{" "}
                {pagination.total ===
                1
                  ? "Job"
                  : "Jobs"}
              </span>
            )}
        </div>

        {/* LOADING */}

        {loading && (
          <div className="flex min-h-[280px] flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

            <p className="mt-3 text-xs font-medium text-slate-500">
              Loading processing history...
            </p>
          </div>
        )}

        {/* ERROR */}

        {!loading &&
          error && (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <svg
                  className="h-5 w-5"
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
                    d="M10.3 3.8L2.9 17a2 2 0 001.75 3h14.7a2 2 0 001.75 3L13.7 3.8a2 2 0 00-3.4 0z"
                  />
                </svg>
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-800">
                {error}
              </p>

              <button
                type="button"
                onClick={
                  handleRefresh
                }
                className="mt-3 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Try Again
              </button>
            </div>
          )}

        {/* EMPTY */}

        {!loading &&
          !error &&
          history.length === 0 && (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">

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

              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                No processing history
              </h3>

              <p className="mt-1 max-w-sm text-xs text-slate-500">
                No records match your
                current search or
                filters.
              </p>

              {(search ||
                type !== "ALL" ||
                status !== "ALL" ||
                fromDate ||
                toDate) && (
                <button
                  type="button"
                  onClick={
                    handleResetFilters
                  }
                  className="mt-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

        {/* TABLE */}

        {!loading &&
          !error &&
          history.length > 0 && (
            <>
              <div className="overflow-x-auto">

                <table className="w-full min-w-[1180px]">

                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Type
                      </th>

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Job / Voucher
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

                      <th className="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Status
                      </th>

                      <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Action
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {history.map(
                      (
                        item: HistoryItem
                      ) => (
                        <tr
                          key={
                            item.record_id ??
                            item.job_id
                          }
                          className="transition-colors hover:bg-slate-50"
                        >

                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                item.processing_type ===
                                "SINGLE"
                                  ? "bg-violet-50 text-violet-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  item.processing_type ===
                                  "SINGLE"
                                    ? "bg-violet-500"
                                    : "bg-blue-500"
                                }`}
                              />

                              {item.processing_type ===
                              "SINGLE"
                                ? "Single"
                                : "Bulk"}
                            </span>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">

                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                                  item.processing_type ===
                                  "SINGLE"
                                    ? "bg-violet-50 text-violet-600"
                                    : "bg-blue-50 text-blue-600"
                                }`}
                              >
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

                              <div className="min-w-0">

                                <div
                                  className="max-w-[220px] truncate font-mono text-xs font-semibold text-slate-800"
                                  title={
                                    item.processing_type ===
                                    "SINGLE"
                                      ? item.voucher_number ||
                                        item.job_id
                                      : item.job_id
                                  }
                                >
                                  {item.processing_type ===
                                  "SINGLE"
                                    ? item.voucher_number ||
                                      item.job_id
                                    : item.job_id}
                                </div>

                                {item.processing_type ===
                                  "BULK" &&
                                  item.source_file_name && (
                                    <div
                                      className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-400"
                                      title={
                                        item.source_file_name
                                      }
                                    >
                                      {
                                        item.source_file_name
                                      }
                                    </div>
                                  )}
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                            {formatDate(
                              item.processed_at
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            <span className="text-xs font-bold text-slate-800">
                              {(
                                item.total_count ||
                                0
                              ).toLocaleString(
                                "en-IN"
                              )}
                            </span>
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

                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStatusStyle(
                                item
                              )}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${getStatusDotStyle(
                                  item
                                )}`}
                              />

                              {getStatus(
                                item
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedJob(
                                  item
                                )
                              }
                              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              View
                            </button>
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>
              </div>

              {/* =================================================
                  PAGINATION
              ================================================= */}

              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="text-[11px] text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {showingFrom.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                  {" – "}

                  <span className="font-semibold text-slate-700">
                    {showingTo.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                  {" of "}

                  <span className="font-semibold text-slate-700">
                    {pagination.total.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                  {" jobs"}
                </div>

                <div className="flex flex-wrap items-center gap-3">

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-400">
                      Rows
                    </span>

                    <select
                      value={limit}
                      onChange={(
                        event
                      ) =>
                        handleLimitChange(
                          Number(
                            event
                              .target
                              .value
                          )
                        )
                      }
                      disabled={
                        loading
                      }
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value={25}>
                        25
                      </option>

                      <option value={50}>
                        50
                      </option>

                      <option value={100}>
                        100
                      </option>
                    </select>
                  </div>

                  {pagination.totalPages >
                    1 && (
                    <div className="flex items-center gap-1">

                      <button
                        type="button"
                        onClick={() =>
                          handlePageChange(
                            pagination.page -
                              1
                          )
                        }
                        disabled={
                          loading ||
                          !pagination.hasPreviousPage
                        }
                        className="flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ←

                        <span className="ml-1 hidden sm:inline">
                          Previous
                        </span>
                      </button>

                      {pageNumbers.map(
                        (
                          pageNumber,
                          index
                        ) => {
                          if (
                            pageNumber ===
                            "..."
                          ) {
                            return (
                              <span
                                key={`ellipsis-${index}`}
                                className="flex h-8 w-8 items-center justify-center text-[11px] text-slate-400"
                              >
                                ...
                              </span>
                            );
                          }

                          const isActive =
                            pageNumber ===
                            pagination.page;

                          return (
                            <button
                              key={
                                pageNumber
                              }
                              type="button"
                              onClick={() =>
                                handlePageChange(
                                  pageNumber
                                )
                              }
                              disabled={
                                loading
                              }
                              className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition ${
                                isActive
                                  ? "bg-slate-900 text-white"
                                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {
                                pageNumber
                              }
                            </button>
                          );
                        }
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handlePageChange(
                            pagination.page +
                              1
                          )
                        }
                        disabled={
                          loading ||
                          !pagination.hasNextPage
                        }
                        className="flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="mr-1 hidden sm:inline">
                          Next
                        </span>

                        →
                      </button>

                    </div>
                  )}
                </div>
              </div>
            </>
          )}
      </section>

      {/* =================================================
          JOB DETAILS MODAL
      ================================================= */}

      {selectedJob && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedJob(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-details-title"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
                  Processing Job
                </p>

                <h2
                  id="job-details-title"
                  className="mt-1 text-lg font-bold tracking-tight text-slate-900"
                >
                  Job Details
                </h2>

                <p
                  className="mt-1 max-w-[420px] truncate font-mono text-[11px] text-slate-400"
                  title={selectedJob.job_id}
                >
                  {selectedJob.job_id}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedJob(null)
                }
                aria-label="Close job details"
                className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                <JobDetailBox
                  label="Type"
                  value={getDetailTypeLabel(
                    selectedJob.processing_type
                  )}
                />

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Status
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getDetailStatusStyle(
                      selectedJob
                    )}`}
                  >
                    {getStatus(
                      selectedJob
                    )}
                  </span>
                </div>

                <JobDetailBox
                  label="Record ID"
                  value={String(
                    selectedJob.record_id ??
                      "-"
                  )}
                  mono
                />
              </div>

              <div className="mt-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Processing Summary
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                  <JobDetailMetric
                    label="Total"
                    value={
                      selectedJob.total_count
                    }
                    tone="neutral"
                  />

                  <JobDetailMetric
                    label="Successful"
                    value={
                      selectedJob.successful_count
                    }
                    tone="success"
                  />

                  <JobDetailMetric
                    label="Failed"
                    value={
                      selectedJob.failed_count
                    }
                    tone="danger"
                  />

                  <JobDetailMetric
                    label="Duplicates"
                    value={
                      selectedJob.duplicate_count
                    }
                    tone="warning"
                  />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-white">

                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Job Information
                  </p>
                </div>

                <div className="divide-y divide-slate-100 px-4">

                  <JobDetailRow
                    label="Job ID"
                    value={
                      selectedJob.job_id
                    }
                    mono
                  />

                  <JobDetailRow
                    label="Processing Type"
                    value={getDetailTypeLabel(
                      selectedJob.processing_type
                    )}
                  />

                  <JobDetailRow
                    label="Voucher Number"
                    value={
                      selectedJob.voucher_number ||
                      "-"
                    }
                    mono
                  />

                  <JobDetailRow
                    label="Source File"
                    value={
                      selectedJob.source_file_name ||
                      "-"
                    }
                  />

                  <JobDetailRow
                    label="Source File Type"
                    value={
                      selectedJob.source_file_type ||
                      "-"
                    }
                  />

                  <JobDetailRow
                    label="Total Files"
                    value={String(
                      selectedJob.total_files ??
                        0
                    )}
                  />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-white">

                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Processing Timeline
                  </p>
                </div>

                <div className="divide-y divide-slate-100 px-4">

                  <JobDetailRow
                    label="Created"
                    value={formatDate(
                      selectedJob.created_at
                    )}
                  />

                  <JobDetailRow
                    label="Started"
                    value={formatDate(
                      selectedJob.started_at
                    )}
                  />

                  <JobDetailRow
                    label="Completed"
                    value={formatDate(
                      selectedJob.completed_at
                    )}
                  />

                  <JobDetailRow
                    label="Processed"
                    value={formatDate(
                      selectedJob.processed_at
                    )}
                  />
                </div>
              </div>

              {selectedJob.error_message &&
                selectedJob.error_message.trim() &&
                selectedJob.error_message
                  .trim()
                  .toUpperCase() !==
                  "NONE" && (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">

                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-600">
                      Error Message
                    </p>

                    <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-red-800">
                      {
                        selectedJob.error_message
                      }
                    </p>
                  </div>
                )}
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">

              <button
                type="button"
                onClick={() =>
                  setSelectedJob(null)
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// HISTORY METRIC
// =====================================================

interface HistoryMetricProps {
  label: string;
  value: number;
  description: string;

  type:
    | "neutral"
    | "success"
    | "danger"
    | "warning";

  icon: ReactNode;
}

function HistoryMetric({
  label,
  value,
  description,
  type,
  icon,
}: HistoryMetricProps) {
  const styles = {
    neutral: {
      icon: "bg-slate-100 text-slate-600",
      value: "text-slate-900",
    },

    success: {
      icon: "bg-emerald-50 text-emerald-600",
      value: "text-slate-900",
    },

    danger: {
      icon: "bg-red-50 text-red-600",
      value: "text-slate-900",
    },

    warning: {
      icon: "bg-amber-50 text-amber-600",
      value: "text-slate-900",
    },
  };

  const style =
    styles[type];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">

      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${style.icon}`}
      >
        {icon}
      </div>

      <p className="mt-4 text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-2xl font-bold tracking-tight ${style.value}`}
      >
        {value.toLocaleString(
          "en-IN"
        )}
      </p>

      <p className="mt-1 text-[10px] text-slate-400">
        {description}
      </p>
    </div>
  );
}

// =====================================================
// JOB DETAIL BOX
// =====================================================

function JobDetailBox({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-semibold text-slate-800 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// =====================================================
// JOB DETAIL ROW
// =====================================================

function JobDetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5 py-3">

      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>

      <span
        className={`max-w-[68%] break-words text-right text-xs font-semibold text-slate-700 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// =====================================================
// JOB DETAIL METRIC
// =====================================================

function JobDetailMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "neutral"
    | "success"
    | "danger"
    | "warning";
}) {
  const styles = {
    neutral:
      "border-slate-200 bg-slate-50 text-slate-800",

    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800",

    danger:
      "border-red-200 bg-red-50 text-red-800",

    warning:
      "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div
      className={`rounded-xl border p-3 ${styles[tone]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold">
        {(value || 0).toLocaleString(
          "en-IN"
        )}
      </p>
    </div>
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
      className={`inline-flex min-w-9 items-center justify-center rounded-md px-2 py-1 text-xs font-bold ${styles[type]}`}
    >
      {(value || 0).toLocaleString(
        "en-IN"
      )}
    </span>
  );
}

export default History;