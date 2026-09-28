"use client";

import { useEffect, useState } from "react";

interface ApplicationHealth {
  status?: string | null;
  environment?: string | null;
}

interface DatabaseHealth {
  status?: string | null;
  responseTimeMs?: number | null;
}

interface SystemStatistics {
  invoiceFiles?: number | null;
  users?: number | null;
  activeSessions?: number | null;
  processingRecords?: number | null;
}

interface ServerInformation {
  nodeVersion?: string | null;
  platform?: string | null;
  architecture?: string | null;
  uptimeSeconds?: number | null;
}

interface SystemHealth {
  application?: ApplicationHealth | null;
  database?: DatabaseHealth | null;
  statistics?: SystemStatistics | null;
  server?: ServerInformation | null;
  responseTimeMs?: number | null;
  checkedAt?: string | null;
}

interface SystemHealthResponse extends SystemHealth {
  message?: string;
}

interface StatusBadgeProps {
  status: string;
}

export default function SystemPage() {
  const [system, setSystem] =
    useState<SystemHealth | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  const fetchSystemHealth =
    async (): Promise<void> => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/admin/system",
          {
            cache: "no-store",
          }
        );

        const data: SystemHealthResponse =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load system health."
          );
        }

        setSystem(data);
      } catch (err: unknown) {
        console.error(
          "System health error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load system health."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchSystemHealth();
  }, []);

  const formatUptime = (
    seconds: number | null | undefined
  ): string => {
    if (
      seconds === undefined ||
      seconds === null
    ) {
      return "-";
    }

    const days = Math.floor(
      seconds / 86400
    );

    const hours = Math.floor(
      (seconds % 86400) / 3600
    );

    const minutes = Math.floor(
      (seconds % 3600) / 60
    );

    return `${days}d ${hours}h ${minutes}m`;
  };

  const StatusBadge = ({
    status,
  }: StatusBadgeProps) => {
    const isHealthy =
      status === "UP" ||
      status === "CONNECTED";

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
          isHealthy
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isHealthy
              ? "bg-emerald-500"
              : "bg-red-500"
          }`}
        />

        {status}
      </span>
    );
  };

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Administration
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            System Health
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            Monitor application, Oracle database, sessions
            and server status.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSystemHealth}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-sm">
            {loading ? "↻" : "⟳"}
          </span>

          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <div className="font-semibold">
            System health check failed
          </div>

          <div className="mt-1">
            {error}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !system ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(
            (item: number) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-lg bg-slate-200"
              />
            )
          )}
        </div>
      ) : system ? (
        <>
          {/* Application / Database */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* Application */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Application
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Application Server
                  </h2>
                </div>

                <div className="text-2xl">
                  🖥️
                </div>
              </div>

              <div className="mt-3">
                <StatusBadge
                  status={
                    system.application?.status ||
                    "UNKNOWN"
                  }
                />
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">
                    Environment
                  </span>

                  <span className="font-semibold text-slate-800">
                    {system.application
                      ?.environment || "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Oracle Database */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Database
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Oracle Database
                  </h2>
                </div>

                <div className="text-2xl">
                  🗄️
                </div>
              </div>

              <div className="mt-3">
                <StatusBadge
                  status={
                    system.database?.status ||
                    "UNKNOWN"
                  }
                />
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">
                    Response Time
                  </span>

                  <span className="font-semibold text-slate-800">
                    {system.database
                      ?.responseTimeMs ?? "-"}{" "}
                    ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-slate-900">
              System Statistics
            </h2>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Invoice Files"
                value={
                  system.statistics
                    ?.invoiceFiles ?? 0
                }
                description="Existing invoice file records"
              />

              <StatCard
                label="Users"
                value={
                  system.statistics
                    ?.users ?? 0
                }
                description="Registered application users"
              />

              <StatCard
                label="Active Sessions"
                value={
                  system.statistics
                    ?.activeSessions ?? 0
                }
                description="Currently active sessions"
              />

              <StatCard
                label="Processing Records"
                value={
                  system.statistics
                    ?.processingRecords ?? 0
                }
                description="Total processing jobs"
              />
            </div>
          </div>

          {/* Server Information */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3.5">
              <h2 className="text-sm font-bold text-slate-900">
                Server Information
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Runtime information for the current
                application server.
              </p>
            </div>

            <div className="grid gap-0 md:grid-cols-2">
              <InfoItem
                label="Node.js Version"
                value={
                  system.server?.nodeVersion || "-"
                }
                borderRight
              />

              <InfoItem
                label="Platform"
                value={
                  system.server?.platform || "-"
                }
              />

              <InfoItem
                label="Architecture"
                value={
                  system.server?.architecture || "-"
                }
                borderRight
              />

              <InfoItem
                label="Server Uptime"
                value={formatUptime(
                  system.server?.uptimeSeconds
                )}
              />

              <InfoItem
                label="API Response"
                value={`${system.responseTimeMs ?? "-"} ms`}
                borderRight
              />

              <InfoItem
                label="Last Checked"
                value={
                  system.checkedAt
                    ? new Date(
                        system.checkedAt
                      ).toLocaleString("en-IN")
                    : "-"
                }
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

interface StatCardComponentProps {
  label: string;
  value: number;
  description: string;
}

function StatCard({
  label,
  value,
  description,
}: StatCardComponentProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value.toLocaleString("en-IN")}
      </p>

      <p className="mt-0.5 text-[10px] text-slate-400">
        {description}
      </p>
    </div>
  );
}

interface InfoItemProps {
  label: string;
  value: string;
  borderRight?: boolean;
}

function InfoItem({
  label,
  value,
  borderRight = false,
}: InfoItemProps) {
  return (
    <div
      className={`border-b border-slate-100 px-4 py-3.5 ${
        borderRight ? "md:border-r" : ""
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1.5 text-xs font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}