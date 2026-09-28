import { NextResponse } from "next/server";
import oracledb from "oracledb";

import { getAuthenticatedUser } from "@/src/auth/auth";
import { getOracleConnection } from "@/src/db/oracle";

export const dynamic = "force-dynamic";

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
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Admin authorization
    // --------------------------------------------------

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 3. Oracle connection
    // --------------------------------------------------

    oracleConnection = await getOracleConnection();

    // --------------------------------------------------
    // 4. User metrics
    // --------------------------------------------------

    const usersResult =
      await oracleConnection.execute<{
        TOTAL_USERS: number;
        ACTIVE_USERS: number;
        INACTIVE_USERS: number;
        ADMIN_USERS: number;
      }>(
        `
          SELECT
            COUNT(*) AS TOTAL_USERS,

            SUM(
              CASE
                WHEN STATUS = 'ACTIVE'
                THEN 1
                ELSE 0
              END
            ) AS ACTIVE_USERS,

            SUM(
              CASE
                WHEN STATUS = 'INACTIVE'
                THEN 1
                ELSE 0
              END
            ) AS INACTIVE_USERS,

            SUM(
              CASE
                WHEN ROLE = 'ADMIN'
                THEN 1
                ELSE 0
              END
            ) AS ADMIN_USERS

          FROM INVC_APP_USERS
        `,
        {},
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

    // --------------------------------------------------
    // 5. Record / invoice metrics
    // --------------------------------------------------

    const recordsResult =
      await oracleConnection.execute<{
        TOTAL_JOBS: number;
        TOTAL_INVOICES: number;
        SUCCESSFUL_INVOICES: number;
        FAILED_INVOICES: number;
        DUPLICATE_INVOICES: number;
        TOTAL_FILES: number;
        PROCESSING: number;
        COMPLETED: number;
        PARTIAL: number;
        FAILED: number;
      }>(
        `
          SELECT
            COUNT(*) AS TOTAL_JOBS,

            NVL(
              SUM(TOTAL_INVOICES),
              0
            ) AS TOTAL_INVOICES,

            NVL(
              SUM(SUCCESSFUL_INVOICES),
              0
            ) AS SUCCESSFUL_INVOICES,

            NVL(
              SUM(FAILED_INVOICES),
              0
            ) AS FAILED_INVOICES,

            NVL(
              SUM(DUPLICATE_INVOICES),
              0
            ) AS DUPLICATE_INVOICES,

            NVL(
              SUM(TOTAL_FILES),
              0
            ) AS TOTAL_FILES,

            SUM(
              CASE
                WHEN STATUS = 'PROCESSING'
                THEN 1
                ELSE 0
              END
            ) AS PROCESSING,

            SUM(
              CASE
                WHEN STATUS = 'COMPLETED'
                THEN 1
                ELSE 0
              END
            ) AS COMPLETED,

            SUM(
              CASE
                WHEN STATUS = 'PARTIAL'
                THEN 1
                ELSE 0
              END
            ) AS PARTIAL,

            SUM(
              CASE
                WHEN STATUS = 'FAILED'
                THEN 1
                ELSE 0
              END
            ) AS FAILED

          FROM INVC_RECORDS
        `,
        {},
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

    // --------------------------------------------------
    // 6. Recent jobs
    // --------------------------------------------------

    const recentJobsResult =
      await oracleConnection.execute<{
        RECORD_ID: number;
        JOB_ID: string;
        SOURCE_FILE_NAME: string | null;
        TOTAL_INVOICES: number;
        SUCCESSFUL_INVOICES: number;
        FAILED_INVOICES: number;
        TOTAL_FILES: number;
        STATUS: string;
        STARTED_AT: Date;
        COMPLETED_AT: Date | null;
        FULL_NAME: string | null;
        EMAIL: string | null;
      }>(
        `
          SELECT
            r.RECORD_ID,
            r.JOB_ID,
            r.SOURCE_FILE_NAME,
            r.TOTAL_INVOICES,
            r.SUCCESSFUL_INVOICES,
            r.FAILED_INVOICES,
            r.TOTAL_FILES,
            r.STATUS,
            r.STARTED_AT,
            r.COMPLETED_AT,
            u.FULL_NAME,
            u.EMAIL

          FROM INVC_RECORDS r

          LEFT JOIN INVC_APP_USERS u
            ON u.USER_ID = r.USER_ID

          ORDER BY r.CREATED_AT DESC

          FETCH FIRST 8 ROWS ONLY
        `,
        {},
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

    // --------------------------------------------------
    // 7. Recent users
    // --------------------------------------------------

    const recentUsersResult =
      await oracleConnection.execute<{
        USER_ID: number;
        EMAIL: string;
        FULL_NAME: string | null;
        ROLE: "USER" | "ADMIN";
        STATUS:
          | "ACTIVE"
          | "INACTIVE"
          | "LOCKED";
        CREATED_AT: Date;
        LAST_LOGIN_AT: Date | null;
      }>(
        `
          SELECT
            USER_ID,
            EMAIL,
            FULL_NAME,
            ROLE,
            STATUS,
            CREATED_AT,
            LAST_LOGIN_AT

          FROM INVC_APP_USERS

          ORDER BY CREATED_AT DESC

          FETCH FIRST 5 ROWS ONLY
        `,
        {},
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

    // --------------------------------------------------
    // 8. Normalize summary rows
    // --------------------------------------------------

    const users =
      usersResult.rows?.[0];

    const records =
      recordsResult.rows?.[0];

    if (!users || !records) {
      throw new Error(
        "Oracle dashboard query returned no summary data"
      );
    }

    // --------------------------------------------------
    // 9. Return dashboard response
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      metrics: {
        users: {
          total_users:
            Number(users.TOTAL_USERS ?? 0),

          active_users:
            Number(users.ACTIVE_USERS ?? 0),

          inactive_users:
            Number(users.INACTIVE_USERS ?? 0),

          admin_users:
            Number(users.ADMIN_USERS ?? 0),
        },

        jobs: {
          total_jobs:
            Number(records.TOTAL_JOBS ?? 0),
        },

        invoices: {
          total_invoices:
            Number(
              records.TOTAL_INVOICES ?? 0
            ),

          successful_invoices:
            Number(
              records.SUCCESSFUL_INVOICES ?? 0
            ),

          failed_invoices:
            Number(
              records.FAILED_INVOICES ?? 0
            ),

          duplicate_invoices:
            Number(
              records.DUPLICATE_INVOICES ?? 0
            ),

          total_files:
            Number(
              records.TOTAL_FILES ?? 0
            ),
        },

        processing: {
          processing:
            Number(
              records.PROCESSING ?? 0
            ),

          completed:
            Number(
              records.COMPLETED ?? 0
            ),

          partial:
            Number(
              records.PARTIAL ?? 0
            ),

          failed:
            Number(
              records.FAILED ?? 0
            ),
        },
      },

      recentJobs:
        recentJobsResult.rows ?? [],

      recentUsers:
        recentUsersResult.rows ?? [],
    });
  } catch (error) {
    console.error(
      "Admin dashboard API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load admin dashboard",
      },
      { status: 500 }
    );
  } finally {
    // --------------------------------------------------
    // 10. Close Oracle connection
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