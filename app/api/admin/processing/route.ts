import { NextResponse } from "next/server";
import oracledb from "oracledb";

import { getAuthenticatedUser } from "@/src/auth/auth";
import { getOracleConnection } from "@/src/db/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OracleProcessingRow {
  RECORD_ID: number;
  JOB_ID: string;
  USER_ID: number | null;
  FULL_NAME: string | null;
  EMAIL: string | null;
  SOURCE_FILE_NAME: string | null;
  SOURCE_FILE_TYPE: string | null;
  TOTAL_INVOICES: number;
  SUCCESSFUL_INVOICES: number;
  FAILED_INVOICES: number;
  DUPLICATE_INVOICES: number;
  TOTAL_FILES: number;
  STATUS: string;
  ERROR_MESSAGE: string | null;
  STARTED_AT: Date | null;
  COMPLETED_AT: Date | null;
  CREATED_AT: Date | null;
}

interface ProcessingRecord {
  record_id: number;
  job_id: string;
  user_id: number | null;
  full_name: string | null;
  email: string | null;
  source_file_name: string | null;
  source_file_type: string | null;
  total_invoices: number;
  successful_invoices: number;
  failed_invoices: number;
  duplicate_invoices: number;
  total_files: number;
  status: string;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date | null;
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = new Date(value as string | number | Date);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeRecord(record: ProcessingRecord) {
  return {
    record_id: record.record_id,
    job_id: record.job_id,

    user_id:
      record.user_id === null || record.user_id === undefined
        ? null
        : Number(record.user_id),

    full_name: record.full_name ?? null,
    email: record.email ?? null,

    source_file_name: record.source_file_name ?? null,
    source_file_type: record.source_file_type ?? null,

    total_invoices: Number(record.total_invoices ?? 0),
    successful_invoices: Number(record.successful_invoices ?? 0),
    failed_invoices: Number(record.failed_invoices ?? 0),
    duplicate_invoices: Number(record.duplicate_invoices ?? 0),
    total_files: Number(record.total_files ?? 0),

    status: record.status,

    error_message: record.error_message ?? null,

    started_at: normalizeDate(record.started_at),
    completed_at: normalizeDate(record.completed_at),
    created_at: normalizeDate(record.created_at),
  };
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
    // 4. Fetch processing records
    //
    // IMPORTANT:
    // INVC_RECORDS.USER_ID -> INVC_APP_USERS.USER_ID
    // This gives us the actual user name and email.
    // --------------------------------------------------

    const oracleResult =
      await oracleConnection.execute<OracleProcessingRow>(
        `
          SELECT
            r.RECORD_ID,
            r.JOB_ID,
            r.USER_ID,

            u.FULL_NAME AS FULL_NAME,
            u.EMAIL AS EMAIL,

            r.SOURCE_FILE_NAME,
            r.SOURCE_FILE_TYPE,
            r.TOTAL_INVOICES,
            r.SUCCESSFUL_INVOICES,
            r.FAILED_INVOICES,
            r.DUPLICATE_INVOICES,
            r.TOTAL_FILES,
            r.STATUS,
            r.ERROR_MESSAGE,
            r.STARTED_AT,
            r.COMPLETED_AT,
            r.CREATED_AT

          FROM INVC_RECORDS r

          LEFT JOIN INVC_APP_USERS u
            ON u.USER_ID = r.USER_ID

          ORDER BY r.CREATED_AT DESC

          FETCH FIRST 100 ROWS ONLY
        `,
        {},
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,

          fetchInfo: {
            FULL_NAME: {
              type: oracledb.STRING,
            },

            EMAIL: {
              type: oracledb.STRING,
            },

            SOURCE_FILE_NAME: {
              type: oracledb.STRING,
            },

            SOURCE_FILE_TYPE: {
              type: oracledb.STRING,
            },

            ERROR_MESSAGE: {
              type: oracledb.STRING,
            },
          },
        }
      );

    // --------------------------------------------------
    // 5. Convert Oracle rows
    // --------------------------------------------------

    const records: ProcessingRecord[] = (
      oracleResult.rows ?? []
    ).map((row) => ({
      record_id: Number(row.RECORD_ID),

      job_id: row.JOB_ID,

      user_id:
        row.USER_ID === null || row.USER_ID === undefined
          ? null
          : Number(row.USER_ID),

      /*
       * Actual name from INVC_APP_USERS
       */
      full_name: row.FULL_NAME ?? null,

      /*
       * Actual email from INVC_APP_USERS
       */
      email: row.EMAIL ?? null,

      source_file_name:
        row.SOURCE_FILE_NAME ?? null,

      source_file_type:
        row.SOURCE_FILE_TYPE ?? null,

      total_invoices:
        Number(row.TOTAL_INVOICES ?? 0),

      successful_invoices:
        Number(row.SUCCESSFUL_INVOICES ?? 0),

      failed_invoices:
        Number(row.FAILED_INVOICES ?? 0),

      duplicate_invoices:
        Number(row.DUPLICATE_INVOICES ?? 0),

      total_files:
        Number(row.TOTAL_FILES ?? 0),

      status:
        row.STATUS,

      error_message:
        row.ERROR_MESSAGE ?? null,

      started_at:
        row.STARTED_AT ?? null,

      completed_at:
        row.COMPLETED_AT ?? null,

      created_at:
        row.CREATED_AT ?? null,
    }));

    // --------------------------------------------------
    // 6. Return response
    //
    // Frontend expects:
    // record.full_name
    // record.email
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      records: records.map(normalizeRecord),
    });
  } catch (error) {
    console.error(
      "Admin processing API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load processing records",
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