import { NextResponse } from "next/server";

import {
  getAuthenticatedUser,
} from "@/src/auth/auth";

import {
  createVoucherZipStream,
  getVoucherFiles,
} from "@/src/services/voucher-download.service";

import {
  parseInputFile,
} from "@/src/utils/input-file";

import {
  voucherNumbersSchema,
} from "@/src/validation/voucher.validation";

import {
  createProcessingRecord,
  updateProcessingRecord,
} from "@/src/db/repositories/records.repository";

export const runtime = "nodejs";

// --------------------------------------------------
// Error Messages
// --------------------------------------------------

const INPUT_FILE_ERROR_MESSAGES: Record<
  string,
  string
> = {
  INPUT_FILE_REQUIRED:
    "Input file is required",

  INVALID_FILE_NAME:
    "Input file name is invalid",

  FILE_NAME_TOO_LONG:
    "Input file name is too long",

  EMPTY_FILE:
    "Uploaded file is empty",

  FILE_TOO_LARGE:
    "Input file must not exceed 5 MB",

  UNSUPPORTED_FILE_TYPE:
    "Only CSV, XLSX and XLS files are supported",

  EMPTY_WORKBOOK:
    "Excel file does not contain any worksheet",

  EMPTY_WORKSHEET:
    "Input file does not contain any data",

  INVALID_INPUT_FILE:
    "Input file must contain a voucher_number header and at least one voucher number",

  INVALID_INPUT_HEADER:
    'Input file must contain exactly one column named "voucher_number"',

  NO_VOUCHER_NUMBERS:
    "No voucher numbers were found in the input file",

  TOO_MANY_ROWS:
    "Input file contains too many rows",
};

const ZIP_ERROR_MESSAGES: Record<
  string,
  string
> = {
  TOO_MANY_ZIP_FILES:
    "Too many files were found for ZIP generation",

  ZIP_CONTENT_TOO_LARGE:
    "Total file size is too large for ZIP generation",
};

// --------------------------------------------------
// POST
// --------------------------------------------------

export async function POST(
  request: Request
) {
  let jobId: string | null = null;

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
          error: "INPUT_FILE_REQUIRED",
          message:
            "CSV, XLSX or XLS file is required",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. Create processing job
    // --------------------------------------------------

    jobId =
      crypto.randomUUID();

    await createProcessingRecord({
      jobId,

      userId:
        user.userId,

      sourceFileName:
        file.name,

      sourceFileType:
        file.name
          .split(".")
          .pop()
          ?.toLowerCase() ?? null,
    });

    // --------------------------------------------------
    // 3. Parse input file
    // --------------------------------------------------

    let parsedFile;

    try {
      parsedFile =
        await parseInputFile(file);
    } catch (error) {
      const errorCode =
        error instanceof Error
          ? error.message
          : "INVALID_INPUT_FILE";

      const message =
        INPUT_FILE_ERROR_MESSAGES[
          errorCode
        ] ??
        "Unable to parse input file";

      await updateProcessingRecord(
        jobId,
        {
          totalInvoices: 0,

          successfulInvoices: 0,

          failedInvoices: 0,

          duplicateInvoices: 0,

          totalFiles: 0,

          status: "FAILED",

          errorMessage:
            message,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error: errorCode,
          message,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 4. Validate voucher numbers
    // --------------------------------------------------

    const validationResult =
      voucherNumbersSchema.safeParse(
        parsedFile.voucherNumbers
      );

    if (!validationResult.success) {
      const totalInvalidRows =
        parsedFile
          .voucherNumbers
          .length;

      await updateProcessingRecord(
        jobId,
        {
          totalInvoices:
            totalInvalidRows,

          successfulInvoices: 0,

          failedInvoices:
            totalInvalidRows,

          duplicateInvoices: 0,

          totalFiles: 0,

          status: "FAILED",

          errorMessage:
            "One or more voucher numbers are invalid",
        }
      );

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
    // 5. Fetch files from Oracle
    //
    // getVoucherFiles() uses the Oracle
    // INVC_INVOICE_FILES repository.
    // --------------------------------------------------

    const vouchers =
      await getVoucherFiles(
        validationResult.data
      );

    // --------------------------------------------------
    // 6. Calculate statistics
    // --------------------------------------------------

    const totalVouchers =
      vouchers.length;

    const successfulVouchers =
      vouchers.filter(
        (voucher) =>
          voucher.files.length > 0
      );

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

    const totalFiles =
      vouchers.reduce(
        (total, voucher) =>
          total +
          voucher.files.length,
        0
      );

    const totalInvoices =
      vouchers.length;

    const failedVouchers =
      missingVoucherNumbers.length;

    const jobStatus =
      failedVouchers === 0
        ? "COMPLETED"
        : successfulVouchers.length > 0
          ? "PARTIAL"
          : "FAILED";

    // --------------------------------------------------
    // 7. Update Oracle processing record
    // --------------------------------------------------

    await updateProcessingRecord(
      jobId,
      {
        totalInvoices,

        successfulInvoices:
          successfulVouchers.length,

        failedInvoices:
          failedVouchers,

        duplicateInvoices: 0,

        totalFiles,

        status:
          jobStatus,
      }
    );

    // --------------------------------------------------
    // 8. Create ZIP stream
    // --------------------------------------------------

    let zipStream;

    try {
      zipStream =
        createVoucherZipStream(
          vouchers
        );
    } catch (error) {
      const errorCode =
        error instanceof Error
          ? error.message
          : "ZIP_GENERATION_FAILED";

      const message =
        ZIP_ERROR_MESSAGES[
          errorCode
        ] ??
        "Unable to generate ZIP file";

      await updateProcessingRecord(
        jobId,
        {
          totalInvoices,

          successfulInvoices:
            successfulVouchers.length,

          failedInvoices:
            failedVouchers,

          duplicateInvoices: 0,

          totalFiles,

          status: "FAILED",

          errorMessage:
            message,
        }
      );

      const status =
        errorCode ===
          "TOO_MANY_ZIP_FILES" ||
        errorCode ===
          "ZIP_CONTENT_TOO_LARGE"
          ? 400
          : 500;

      return NextResponse.json(
        {
          success: false,

          error: errorCode,

          message,
        },
        { status }
      );
    }

    // --------------------------------------------------
    // 9. Return ZIP
    // --------------------------------------------------

    const response =
      new NextResponse(
        zipStream
      );

    response.headers.set(
      "Content-Type",
      "application/zip"
    );

    response.headers.set(
      "Content-Disposition",
      'attachment; filename="vouchers.zip"'
    );

    response.headers.set(
      "Cache-Control",
      "no-store"
    );

    response.headers.set(
      "X-Job-Id",
      jobId
    );

    response.headers.set(
      "X-Total-Vouchers",
      String(totalVouchers)
    );

    response.headers.set(
      "X-Successful-Vouchers",
      String(
        successfulVouchers.length
      )
    );

    response.headers.set(
      "X-Missing-Vouchers",
      String(
        missingVoucherNumbers.length
      )
    );

    response.headers.set(
      "X-Total-Files",
      String(totalFiles)
    );

    return response;
  } catch (error) {
    // --------------------------------------------------
    // Unexpected server error
    // --------------------------------------------------

    console.error(
      "Bulk voucher processing failed:",
      error
    );

    // --------------------------------------------------
    // Update failed Oracle processing job
    // --------------------------------------------------

    if (jobId) {
      try {
        await updateProcessingRecord(
          jobId,
          {
            totalInvoices: 0,

            successfulInvoices: 0,

            failedInvoices: 0,

            duplicateInvoices: 0,

            totalFiles: 0,

            status: "FAILED",

            errorMessage:
              "Unable to process input file",
          }
        );
      } catch (recordError) {
        console.error(
          "Failed to update processing record:",
          recordError
        );
      }
    }

    // --------------------------------------------------
    // Safe client response
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: false,

        error:
          "INTERNAL_SERVER_ERROR",

        message:
          "Unable to process input file",
      },
      { status: 500 }
    );
  }
}