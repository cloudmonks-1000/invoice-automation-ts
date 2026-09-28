import { NextResponse } from "next/server";
import oracledb from "oracledb";

import { getAuthenticatedUser } from "@/src/auth/auth";
import { getOracleConnection } from "@/src/db/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DashboardMetricsRow {
  TOTAL_BULK_JOBS: number;
  TOTAL_INVOICES_PROCESSED: number;
  SUCCESSFUL_INVOICES: number;
  FAILED_INVOICES: number;
  DUPLICATE_INVOICES: number;
}

interface RecentActivityRow {
  JOB_ID: string;
  PROCESSED_AT: Date;
  TOTAL_COUNT: number;
  SUCCESSFUL_COUNT: number;
  FAILED_COUNT: number;
  DUPLICATE_COUNT: number;
}

export async function GET() {
  let oracleConnection;

  try {
    // --------------------------------------------------
    // 1. Authentication
    // --------------------------------------------------

    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Oracle connection
    // --------------------------------------------------

    oracleConnection = await getOracleConnection();

    // --------------------------------------------------
    // 3. User scope
    //
    // ADMIN -> all records
    // USER  -> own records only
    // --------------------------------------------------

    const isAdmin = user.role === "ADMIN";

    const userWhereClause = isAdmin
      ? ""
      : "WHERE r.USER_ID = :userId";

    const recentWhereClause = isAdmin
      ? "WHERE r.STATUS IN ('COMPLETED', 'PARTIAL')"
      : `
          WHERE r.USER_ID = :userId
            AND r.STATUS IN ('COMPLETED', 'PARTIAL')
        `;

    const userBind = isAdmin
      ? {}
      : {
          userId: user.userId,
        };

    // --------------------------------------------------
    // 4. Dashboard metrics
    // --------------------------------------------------

    const metricsResult =
      await oracleConnection.execute<DashboardMetricsRow>(
        `
          SELECT
            COUNT(*) AS TOTAL_BULK_JOBS,

            NVL(
              SUM(
                CASE
                  WHEN r.STATUS IN ('COMPLETED', 'PARTIAL')
                  THEN r.TOTAL_INVOICES
                  ELSE 0
                END
              ),
              0
            ) AS TOTAL_INVOICES_PROCESSED,

            NVL(
              SUM(
                CASE
                  WHEN r.STATUS IN ('COMPLETED', 'PARTIAL')
                  THEN r.SUCCESSFUL_INVOICES
                  ELSE 0
                END
              ),
              0
            ) AS SUCCESSFUL_INVOICES,

            NVL(
              SUM(
                CASE
                  WHEN r.STATUS IN ('COMPLETED', 'PARTIAL')
                  THEN r.FAILED_INVOICES
                  ELSE 0
                END
              ),
              0
            ) AS FAILED_INVOICES,

            NVL(
              SUM(
                CASE
                  WHEN r.STATUS IN ('COMPLETED', 'PARTIAL')
                  THEN r.DUPLICATE_INVOICES
                  ELSE 0
                END
              ),
              0
            ) AS DUPLICATE_INVOICES

          FROM INVC_RECORDS r
          ${userWhereClause}
        `,
        userBind,
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

    // --------------------------------------------------
    // 5. Recent activity
    // --------------------------------------------------

    const recentResult =
      await oracleConnection.execute<RecentActivityRow>(
        `
          SELECT
            JOB_ID,
            PROCESSED_AT,
            TOTAL_COUNT,
            SUCCESSFUL_COUNT,
            FAILED_COUNT,
            DUPLICATE_COUNT
          FROM (
            SELECT
              r.JOB_ID,
              r.CREATED_AT AS PROCESSED_AT,
              r.TOTAL_INVOICES AS TOTAL_COUNT,
              r.SUCCESSFUL_INVOICES AS SUCCESSFUL_COUNT,
              r.FAILED_INVOICES AS FAILED_COUNT,
              r.DUPLICATE_INVOICES AS DUPLICATE_COUNT

            FROM INVC_RECORDS r

            ${recentWhereClause}

            ORDER BY r.CREATED_AT DESC
          )
          WHERE ROWNUM <= 10
        `,
        userBind,
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

    // --------------------------------------------------
    // 6. Extract metrics
    // --------------------------------------------------

    const metrics = metricsResult.rows?.[0];

    if (!metrics) {
      throw new Error(
        "Oracle dashboard metrics query returned no data"
      );
    }

    const totalInvoicesProcessed = Number(
      metrics.TOTAL_INVOICES_PROCESSED ?? 0
    );

    const successful = Number(
      metrics.SUCCESSFUL_INVOICES ?? 0
    );

    const failed = Number(
      metrics.FAILED_INVOICES ?? 0
    );

    const duplicates = Number(
      metrics.DUPLICATE_INVOICES ?? 0
    );

    const jobs = Number(
      metrics.TOTAL_BULK_JOBS ?? 0
    );

    // --------------------------------------------------
    // 7. Normalize recent activity
    // --------------------------------------------------

    const recentActivity =
      (recentResult.rows ?? []).map((row) => ({
        job_id: row.JOB_ID,

        processed_at: row.PROCESSED_AT,

        total_count: Number(
          row.TOTAL_COUNT ?? 0
        ),

        successful_count: Number(
          row.SUCCESSFUL_COUNT ?? 0
        ),

        failed_count: Number(
          row.FAILED_COUNT ?? 0
        ),

        duplicate_count: Number(
          row.DUPLICATE_COUNT ?? 0
        ),
      }));

    // --------------------------------------------------
    // 8. Response
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      total_invoices_processed:
        totalInvoicesProcessed,

      successful_invoices:
        successful,

      failed_invoices:
        failed,

      total_bulk_jobs:
        jobs,

      duplicate_invoices:
        duplicates,

      recent_activity:
        recentActivity,
    });
  } catch (error) {
    console.error(
      "Dashboard API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load dashboard data",
      },
      { status: 500 }
    );
  } finally {
    // --------------------------------------------------
    // 9. Close Oracle connection
    // --------------------------------------------------

    if (oracleConnection) {
      try {
        await oracleConnection.close();
      } catch (error) {
        console.error(
          "Failed to close Oracle connection:",
          error
        );
      }
    }
  }
}