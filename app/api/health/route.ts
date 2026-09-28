import { NextResponse } from "next/server";
import oracledb from "oracledb";

import { getOracleConnection } from "@/src/db/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let oracleConnection;

  try {
    const startTime = Date.now();

    // --------------------------------------------------
    // Oracle connection
    // --------------------------------------------------

    oracleConnection =
      await getOracleConnection();

    // --------------------------------------------------
    // Oracle health check
    // --------------------------------------------------

    const oracleResult =
      await oracleConnection.execute<{
        CURRENT_TIME: Date;
      }>(
        `
          SELECT
            CURRENT_TIMESTAMP AS CURRENT_TIME
          FROM DUAL
        `,
        {},
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const oracleTime =
      oracleResult.rows?.[0]
        ?.CURRENT_TIME ?? null;

    const responseTimeMs =
      Date.now() - startTime;

    return NextResponse.json({
      success: true,

      service:
        "invoice-backend",

      database: {
        type: "oracle",
        connected: true,
        time: oracleTime,
        responseTimeMs,
      },
    });
  } catch (error) {
    console.error(
      "Oracle database health check failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        service:
          "invoice-backend",

        database: {
          type: "oracle",
          connected: false,
        },
      },
      { status: 503 }
    );
  } finally {
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