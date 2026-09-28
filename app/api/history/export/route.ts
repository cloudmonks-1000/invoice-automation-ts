import { NextRequest, NextResponse } from "next/server";
import oracledb from "oracledb";

import { getAuthenticatedUser } from "@/src/auth/auth";
import { getOracleConnection } from "@/src/db/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatCsvDate(value: Date | null): string {
  if (!value) {
    return "";
  }

  return value.toISOString();
}

export async function GET(request: NextRequest) {
  let oracleConnection;

  try {
    // =====================================================
    // AUTHENTICATION
    // =====================================================

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

    // =====================================================
    // QUERY PARAMETERS
    // =====================================================

    const searchParams = request.nextUrl.searchParams;

    const search =
      searchParams.get("search")?.trim() || "";

    const type =
      searchParams.get("type")?.trim().toUpperCase() || "";

    const status =
      searchParams.get("status")?.trim().toUpperCase() || "";

    const from =
      searchParams.get("from")?.trim() || "";

    const to =
      searchParams.get("to")?.trim() || "";

    // =====================================================
    // VALIDATE FILTERS
    // =====================================================

    const allowedTypes = ["SINGLE", "BULK"];

    const allowedStatuses = [
      "PROCESSING",
      "COMPLETED",
      "PARTIAL",
      "FAILED",
    ];

    if (type && !allowedTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid processing type",
        },
        { status: 400 }
      );
    }

    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid status",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // DATE VALIDATION
    // =====================================================

    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (from) {
      fromDate = new Date(`${from}T00:00:00`);

      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid from date",
          },
          { status: 400 }
        );
      }
    }

    if (to) {
      toDate = new Date(`${to}T23:59:59.999`);

      if (Number.isNaN(toDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid to date",
          },
          { status: 400 }
        );
      }
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        {
          success: false,
          message: "From date cannot be after to date",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // ORACLE CONNECTION
    // =====================================================

    oracleConnection = await getOracleConnection();

    // =====================================================
    // DYNAMIC WHERE CLAUSE
    // =====================================================

    const conditions: string[] = [];

    const bindParams: Record<
      string,
      string | number | Date
    > = {};

    // -----------------------------------------------------
    // USER SCOPE
    // -----------------------------------------------------

    if (user.role !== "ADMIN") {
      conditions.push("USER_ID = :userId");
      bindParams.userId = user.userId;
    }

    // -----------------------------------------------------
    // SEARCH
    // -----------------------------------------------------

    if (search) {
      conditions.push(`
        (
          UPPER(JOB_ID) LIKE :search
          OR UPPER(VOUCHER_NUMBER) LIKE :search
          OR UPPER(SOURCE_FILE_NAME) LIKE :search
        )
      `);

      bindParams.search =
        `%${search.toUpperCase()}%`;
    }

    // -----------------------------------------------------
    // PROCESSING TYPE
    // -----------------------------------------------------

    if (type) {
      conditions.push(
        "PROCESSING_TYPE = :processingType"
      );

      bindParams.processingType = type;
    }

    // -----------------------------------------------------
    // STATUS
    // -----------------------------------------------------

    if (status) {
      conditions.push("STATUS = :status");
      bindParams.status = status;
    }

    // -----------------------------------------------------
    // FROM DATE
    // -----------------------------------------------------

    if (fromDate) {
      conditions.push("CREATED_AT >= :fromDate");
      bindParams.fromDate = fromDate;
    }

    // -----------------------------------------------------
    // TO DATE
    // -----------------------------------------------------

    if (toDate) {
      conditions.push("CREATED_AT <= :toDate");
      bindParams.toDate = toDate;
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // =====================================================
    // FETCH ALL FILTERED HISTORY
    //
    // IMPORTANT:
    // No OFFSET / FETCH pagination here.
    // Export contains ALL matching records.
    // =====================================================

    const result =
      await oracleConnection.execute<{
        RECORD_ID: number;
        JOB_ID: string;
        USER_ID: number;
        SOURCE_FILE_NAME: string | null;
        SOURCE_FILE_TYPE: string | null;
        PROCESSING_TYPE: string | null;
        VOUCHER_NUMBER: string | null;
        TOTAL_COUNT: number;
        SUCCESSFUL_COUNT: number;
        FAILED_COUNT: number;
        DUPLICATE_INVOICES: number;
        TOTAL_FILES: number;
        STATUS: string;
        ERROR_MESSAGE: string | null;
        STARTED_AT: Date | null;
        COMPLETED_AT: Date | null;
        CREATED_AT: Date | null;
      }>(
        `
          SELECT
            RECORD_ID,
            JOB_ID,
            USER_ID,
            SOURCE_FILE_NAME,
            SOURCE_FILE_TYPE,
            PROCESSING_TYPE,
            VOUCHER_NUMBER,
            TOTAL_INVOICES AS TOTAL_COUNT,
            SUCCESSFUL_INVOICES AS SUCCESSFUL_COUNT,
            FAILED_INVOICES AS FAILED_COUNT,
            DUPLICATE_INVOICES,
            TOTAL_FILES,
            STATUS,
            ERROR_MESSAGE,
            STARTED_AT,
            COMPLETED_AT,
            CREATED_AT
          FROM INVC_RECORDS
          ${whereClause}
          ORDER BY CREATED_AT DESC
        `,
        bindParams,
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,

          fetchInfo: {
            SOURCE_FILE_NAME: {
              type: oracledb.STRING,
            },

            SOURCE_FILE_TYPE: {
              type: oracledb.STRING,
            },

            PROCESSING_TYPE: {
              type: oracledb.STRING,
            },

            VOUCHER_NUMBER: {
              type: oracledb.STRING,
            },

            ERROR_MESSAGE: {
              type: oracledb.STRING,
            },
          },
        }
      );

    // =====================================================
    // CSV HEADER
    // =====================================================

    const headers = [
      "Record ID",
      "Job ID",
      "User ID",
      "Processing Type",
      "Voucher Number",
      "Source File Name",
      "Source File Type",
      "Total Invoices",
      "Successful Invoices",
      "Failed Invoices",
      "Duplicates",
      "Total Files",
      "Status",
      "Error Message",
      "Started At",
      "Completed At",
      "Created At",
    ];

    const csvRows: string[] = [];

    csvRows.push(
      headers.map(csvEscape).join(",")
    );

    // =====================================================
    // CSV DATA
    // =====================================================

    for (const row of result.rows ?? []) {
      csvRows.push(
        [
          row.RECORD_ID,
          row.JOB_ID,
          row.USER_ID,
          row.PROCESSING_TYPE,
          row.VOUCHER_NUMBER,
          row.SOURCE_FILE_NAME,
          row.SOURCE_FILE_TYPE,
          row.TOTAL_COUNT ?? 0,
          row.SUCCESSFUL_COUNT ?? 0,
          row.FAILED_COUNT ?? 0,
          row.DUPLICATE_INVOICES ?? 0,
          row.TOTAL_FILES ?? 0,
          row.STATUS,
          row.ERROR_MESSAGE,
          formatCsvDate(row.STARTED_AT),
          formatCsvDate(row.COMPLETED_AT),
          formatCsvDate(row.CREATED_AT),
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    // BOM helps Excel correctly detect UTF-8.
    const csvContent =
      "\uFEFF" + csvRows.join("\r\n");

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const filename =
      `processing-history-${today}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type":
          "text/csv; charset=utf-8",

        "Content-Disposition":
          `attachment; filename="${filename}"`,

        "Cache-Control":
          "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(
      "History export API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to export processing history",
      },
      { status: 500 }
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