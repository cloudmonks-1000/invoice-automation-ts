import { NextResponse } from "next/server";
import oracledb from "oracledb";

import { getAuthenticatedUser } from "@/src/auth/auth";
import { getOracleConnection } from "@/src/db/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OracleSystemRow {
  INVOICE_FILES_COUNT: number;
  USERS_COUNT: number;
  ACTIVE_SESSIONS_COUNT: number;
  RECORDS_COUNT: number;
}

export async function GET() {
  const startTime = Date.now();

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

    const dbStartTime = Date.now();

    oracleConnection = await getOracleConnection();

    // --------------------------------------------------
    // 4. Oracle statistics
    // --------------------------------------------------

    const result =
      await oracleConnection.execute<OracleSystemRow>(
        `
          SELECT
            (
              SELECT COUNT(*)
              FROM INVC_INVOICE_FILES
            ) AS INVOICE_FILES_COUNT,

            (
              SELECT COUNT(*)
              FROM INVC_APP_USERS
            ) AS USERS_COUNT,

            (
              SELECT COUNT(*)
              FROM INVC_USER_SESSIONS
              WHERE REVOKED_AT IS NULL
                AND EXPIRES_AT > CURRENT_TIMESTAMP
            ) AS ACTIVE_SESSIONS_COUNT,

            (
              SELECT COUNT(*)
              FROM INVC_RECORDS
            ) AS RECORDS_COUNT

          FROM DUAL
        `,
        {},
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const dbResponseTime =
      Date.now() - dbStartTime;

    const row = result.rows?.[0];

    if (!row) {
      throw new Error(
        "Oracle system statistics query returned no data"
      );
    }

    // --------------------------------------------------
    // 5. Total response time
    // --------------------------------------------------

    const totalResponseTime =
      Date.now() - startTime;

    // --------------------------------------------------
    // 6. Return system health
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      application: {
        status: "UP",
        environment:
          process.env.NODE_ENV ||
          "development",
      },

      database: {
        type: "oracle",
        status: "CONNECTED",
        responseTimeMs:
          dbResponseTime,
      },

      statistics: {
        invoiceFiles: Number(
          row.INVOICE_FILES_COUNT ?? 0
        ),

        users: Number(
          row.USERS_COUNT ?? 0
        ),

        activeSessions: Number(
          row.ACTIVE_SESSIONS_COUNT ?? 0
        ),

        processingRecords: Number(
          row.RECORDS_COUNT ?? 0
        ),
      },

      server: {
        platform: process.platform,

        nodeVersion: process.version,

        architecture: process.arch,

        uptimeSeconds: Math.floor(
          process.uptime()
        ),
      },

      responseTimeMs:
        totalResponseTime,

      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Admin system health error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Unable to load system health.",

        application: {
          status: "DOWN",
        },

        database: {
          type: "oracle",
          status: "ERROR",
        },

        checkedAt:
          new Date().toISOString(),
      },
      { status: 500 }
    );
  } finally {
    // --------------------------------------------------
    // 7. Close Oracle connection
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