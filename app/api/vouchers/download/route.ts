import { NextResponse } from "next/server";

import {
  getAuthenticatedUser,
} from "@/src/auth/auth";

import {
  getVoucherFiles,
} from "@/src/services/voucher-download.service";

import {
  voucherNumbersSchema,
} from "@/src/validation/voucher.validation";

export const runtime = "nodejs";

export async function POST(
  request: Request
) {
  try {
    // --------------------------------------------------
    // 0. Authentication
    // --------------------------------------------------

    const user =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 1. Read multipart/form-data
    // --------------------------------------------------

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "CSV_FILE_REQUIRED",
          message: "CSV file is required",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. Basic file validation
    // --------------------------------------------------

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "EMPTY_FILE",
          message:
            "Uploaded CSV file is empty",
        },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "FILE_TOO_LARGE",
          message:
            "CSV file must not exceed 5 MB",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Read CSV content
    // --------------------------------------------------

    const csvText =
      await file.text();

    const lines =
      csvText
        .split(/\r?\n/)
        .map((line) =>
          line.trim()
        )
        .filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CSV",
          message:
            "CSV must contain a voucher_number header and at least one voucher number",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Validate header
    // --------------------------------------------------

    const header =
      lines[0]
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase();

    if (header !== "voucher_number") {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CSV_HEADER",
          message:
            'CSV must contain exactly one column named "voucher_number"',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Extract voucher numbers
    // --------------------------------------------------

    const voucherNumbers =
      lines.slice(1);

    // --------------------------------------------------
    // 6. Validate voucher numbers
    // --------------------------------------------------

    const validationResult =
      voucherNumbersSchema.safeParse(
        voucherNumbers
      );

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_VOUCHER_NUMBERS",
          message:
            "One or more voucher numbers are invalid",
          details:
            validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 7. Fetch voucher files from Oracle
    // --------------------------------------------------
    //
    // getVoucherFiles() uses:
    // INVC_INVOICE_FILES
    //
    // PostgreSQL is not used here.
    // --------------------------------------------------

    const vouchers =
      await getVoucherFiles(
        validationResult.data
      );

    // --------------------------------------------------
    // 8. Find vouchers with no files
    // --------------------------------------------------

    const missingVoucherNumbers =
      vouchers
        .filter(
          (voucher) =>
            voucher.files.length === 0
        )
        .map(
          (voucher) =>
            voucher.voucherNumber
        );

    // --------------------------------------------------
    // 9. Response
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "CSV processed successfully",

      totalVouchers:
        vouchers.length,

      missingVoucherNumbers,

      vouchers:
        vouchers.map(
          (voucher) => ({
            voucherNumber:
              voucher.voucherNumber,

            fileCount:
              voucher.files.length,

            files:
              voucher.files.map(
                (file) => ({
                  fileName:
                    file.fileName,

                  serialNumber:
                    file.serialNumber,
                })
              ),
          })
        ),
    });
  } catch (error) {
    console.error(
      "Bulk voucher CSV processing failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_SERVER_ERROR",
        message:
          "Unable to process voucher CSV",
      },
      { status: 500 }
    );
  }
}