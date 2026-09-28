import { NextRequest, NextResponse } from "next/server";
import oracledb from "oracledb";

import {
  getAuthenticatedUser,
} from "@/src/auth/auth";

import {
  getOracleConnection,
} from "@/src/db/oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function GET(
  request: NextRequest
) {
  let oracleConnection;

  try {
    // =====================================================
    // AUTHENTICATION
    // =====================================================

    const user =
      await getAuthenticatedUser();

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

    const searchParams =
      request.nextUrl.searchParams;

    const search =
      searchParams
        .get("search")
        ?.trim() || "";

    const type =
      searchParams
        .get("type")
        ?.trim()
        .toUpperCase() || "";

    const status =
      searchParams
        .get("status")
        ?.trim()
        .toUpperCase() || "";

    const from =
      searchParams
        .get("from")
        ?.trim() || "";

    const to =
      searchParams
        .get("to")
        ?.trim() || "";

    const requestedPage =
      Number(
        searchParams.get("page") || "1"
      );

    const requestedLimit =
      Number(
        searchParams.get("limit") ||
          String(DEFAULT_LIMIT)
      );

    const page =
      Number.isFinite(requestedPage) &&
      requestedPage > 0
        ? Math.floor(requestedPage)
        : 1;

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(
            Math.floor(requestedLimit),
            MAX_LIMIT
          )
        : DEFAULT_LIMIT;

    const offset =
      (page - 1) * limit;

    // =====================================================
    // VALIDATE FILTERS
    // =====================================================

    const allowedTypes = [
      "SINGLE",
      "BULK",
    ];

    const allowedStatuses = [
      "PROCESSING",
      "COMPLETED",
      "PARTIAL",
      "FAILED",
    ];

    if (
      type &&
      !allowedTypes.includes(type)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid processing type",
        },
        { status: 400 }
      );
    }

    if (
      status &&
      !allowedStatuses.includes(status)
    ) {
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
      fromDate = new Date(
        `${from}T00:00:00`
      );

      if (
        Number.isNaN(
          fromDate.getTime()
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid from date",
          },
          { status: 400 }
        );
      }
    }

    if (to) {
      toDate = new Date(
        `${to}T23:59:59.999`
      );

      if (
        Number.isNaN(
          toDate.getTime()
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid to date",
          },
          { status: 400 }
        );
      }
    }

    if (
      fromDate &&
      toDate &&
      fromDate > toDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "From date cannot be after to date",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // ORACLE CONNECTION
    // =====================================================

    oracleConnection =
      await getOracleConnection();

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
      conditions.push(
        "USER_ID = :userId"
      );

      bindParams.userId =
        user.userId;
    }

    // -----------------------------------------------------
    // SEARCH
    //
    // Searches:
    // JOB_ID
    // VOUCHER_NUMBER
    // SOURCE_FILE_NAME
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

      bindParams.processingType =
        type;
    }

    // -----------------------------------------------------
    // STATUS
    // -----------------------------------------------------

    if (status) {
      conditions.push(
        "STATUS = :status"
      );

      bindParams.status =
        status;
    }

    // -----------------------------------------------------
    // FROM DATE
    // -----------------------------------------------------

    if (fromDate) {
      conditions.push(
        "CREATED_AT >= :fromDate"
      );

      bindParams.fromDate =
        fromDate;
    }

    // -----------------------------------------------------
    // TO DATE
    // -----------------------------------------------------

    if (toDate) {
      conditions.push(
        "CREATED_AT <= :toDate"
      );

      bindParams.toDate =
        toDate;
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(
            " AND "
          )}`
        : "";

    // =====================================================
    // TOTAL COUNT
    // =====================================================

    const countResult =
      await oracleConnection.execute<{
        TOTAL_COUNT: number;
      }>(
        `
          SELECT
            COUNT(*) AS TOTAL_COUNT
          FROM INVC_RECORDS
          ${whereClause}
        `,
        bindParams,
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const totalCount =
      Number(
        countResult.rows?.[0]
          ?.TOTAL_COUNT ?? 0
      );

    const totalPages =
      totalCount > 0
        ? Math.ceil(
            totalCount / limit
          )
        : 0;

    // =====================================================
    // HISTORY DATA
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
          OFFSET :offset ROWS
          FETCH NEXT :limit ROWS ONLY
        `,
        {
          ...bindParams,

          offset,

          limit,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,

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
    // NORMALIZE RESPONSE
    // =====================================================

    const history =
      (result.rows ?? []).map(
        (row) => ({
          record_id:
            Number(
              row.RECORD_ID
            ),

          job_id:
            row.JOB_ID,

          user_id:
            Number(
              row.USER_ID
            ),

          source_file_name:
            row.SOURCE_FILE_NAME ??
            null,

          source_file_type:
            row.SOURCE_FILE_TYPE ??
            null,

          processing_type:
            row.PROCESSING_TYPE ??
            "BULK",

          voucher_number:
            row.VOUCHER_NUMBER ??
            null,

          total_count:
            Number(
              row.TOTAL_COUNT ?? 0
            ),

          successful_count:
            Number(
              row.SUCCESSFUL_COUNT ??
                0
            ),

          failed_count:
            Number(
              row.FAILED_COUNT ?? 0
            ),

          duplicate_count:
            Number(
              row.DUPLICATE_INVOICES ??
                0
            ),

          total_files:
            Number(
              row.TOTAL_FILES ?? 0
            ),

          status:
            row.STATUS,

          error_message:
            row.ERROR_MESSAGE ??
            null,

          started_at:
            row.STARTED_AT ??
            null,

          completed_at:
            row.COMPLETED_AT ??
            null,

          created_at:
            row.CREATED_AT ??
            null,

          // Frontend compatibility
          processed_at:
            row.COMPLETED_AT ??
            row.CREATED_AT ??
            null,
        })
      );

    // =====================================================
    // RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,

      history,

      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPreviousPage:
          page > 1,
      },

      filters: {
        search,
        type: type || "ALL",
        status: status || "ALL",
        from: from || null,
        to: to || null,
      },
    });
  } catch (error) {
    console.error(
      "History API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to load processing history",
      },
      { status: 500 }
    );
  } finally {
    // =====================================================
    // CLOSE ORACLE CONNECTION
    // =====================================================

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