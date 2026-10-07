import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  getAuthenticatedUser,
} from "@/src/auth/auth";

import {
  createProcessingRecord,
  updateProcessingRecord,
} from "@/src/db/repositories/records.repository";

import {
  findFilesByVoucherNumbers,
} from "@/src/db/repositories/voucher.repository";

import { createVoucherZip } from "@/src/utils/zip";

export const runtime = "nodejs";

function sanitizeDownloadFileName(
  fileName: string
): string {
  const cleaned = fileName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim();

  if (!cleaned) {
    return "invoice.pdf";
  }

  return cleaned.replace(
    /[<>:"|?*\x00-\x1F]/g,
    "_"
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      voucherNumber: string;
    }>;
  }
) {
  let jobId: string | null = null;
  let processingRecordCreated = false;

  try {
    // =====================================================
    // AUTHENTICATION
    // =====================================================

    const user = await getAuthenticatedUser();

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

    // =====================================================
    // VOUCHER NUMBER
    // =====================================================

    const { voucherNumber } = await context.params;

    const cleanVoucherNumber =
      voucherNumber?.trim();

    if (!cleanVoucherNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_VOUCHER_NUMBER",
          message: "Voucher number is required",
        },
        { status: 400 }
      );
    }

    if (cleanVoucherNumber.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_VOUCHER_NUMBER",
          message: "Voucher number is too long",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // CREATE PROCESSING RECORD
    // =====================================================

    jobId = `SINGLE-${randomUUID()}`;

    await createProcessingRecord({
      jobId,
      userId: user.userId,
      sourceFileName: cleanVoucherNumber,
      sourceFileType: "SINGLE_VOUCHER",
      processingType: "SINGLE",
      voucherNumber: cleanVoucherNumber,
    });

    processingRecordCreated = true;

    // =====================================================
    // DATABASE SEARCH
    // =====================================================

    const files =
      await findFilesByVoucherNumbers([
        cleanVoucherNumber,
      ]);

    // =====================================================
    // VOUCHER NOT FOUND
    // =====================================================

    if (files.length === 0) {
      await updateProcessingRecord(
        jobId,
        {
          totalInvoices: 1,
          successfulInvoices: 0,
          failedInvoices: 1,
          duplicateInvoices: 0,
          totalFiles: 0,
          status: "FAILED",
          errorMessage:
            "No documents found for this voucher number",
        }
      );

      processingRecordCreated = false;

      return NextResponse.json(
        {
          success: false,
          error: "VOUCHER_NOT_FOUND",
          message:
            "No documents found for this voucher number",
        },
        { status: 404 }
      );
    }

    // =====================================================
    // ALWAYS CREATE ZIP
    //
    // Single file ho ya multiple files,
    // hamesha ZIP return hoga.
    //
    // Repository NULL/0 byte FILE_DATA ko
    // Buffer.alloc(0) ke form mein return karega,
    // isliye woh file bhi ZIP mein rahegi.
    // =====================================================

    const zipFiles = files.map((file) => ({
      folderName: cleanVoucherNumber,
      fileName: sanitizeDownloadFileName(
        file.fileName
      ),
      fileData: file.fileData,
    }));

    let zipStream: ReadableStream<Uint8Array>;

    try {
      zipStream = createVoucherZip(zipFiles);
    } catch (error) {
      console.error(
        "Single voucher ZIP generation error:",
        error
      );

      const errorCode =
        error instanceof Error
          ? error.message
          : "ZIP_GENERATION_FAILED";

      // ===================================================
      // ZIP LIMIT ERRORS
      // ===================================================

      if (
        errorCode === "TOO_MANY_ZIP_FILES" ||
        errorCode === "ZIP_CONTENT_TOO_LARGE"
      ) {
        await updateProcessingRecord(
          jobId,
          {
            totalInvoices: 1,
            successfulInvoices: 0,
            failedInvoices: 1,
            duplicateInvoices: 0,
            totalFiles: files.length,
            status: "FAILED",
            errorMessage: errorCode,
          }
        );

        processingRecordCreated = false;

        return NextResponse.json(
          {
            success: false,
            error: errorCode,
            message:
              errorCode === "TOO_MANY_ZIP_FILES"
                ? "Too many files found for download"
                : "Total file size is too large for download",
          },
          { status: 400 }
        );
      }

      // ===================================================
      // OTHER ZIP ERRORS
      // ===================================================

      await updateProcessingRecord(
        jobId,
        {
          totalInvoices: 1,
          successfulInvoices: 0,
          failedInvoices: 1,
          duplicateInvoices: 0,
          totalFiles: files.length,
          status: "FAILED",
          errorMessage:
            "ZIP_GENERATION_FAILED",
        }
      );

      processingRecordCreated = false;

      return NextResponse.json(
        {
          success: false,
          error: "ZIP_GENERATION_FAILED",
          message:
            "Unable to generate download file",
        },
        { status: 500 }
      );
    }

    // =====================================================
    // MARK PROCESSING AS COMPLETED
    // =====================================================

    await updateProcessingRecord(
      jobId,
      {
        totalInvoices: 1,
        successfulInvoices: 1,
        failedInvoices: 0,
        duplicateInvoices: 0,
        totalFiles: files.length,
        status: "COMPLETED",
        errorMessage: "NONE",
      }
    );

    processingRecordCreated = false;

    // =====================================================
    // ZIP RESPONSE
    // =====================================================

    const response =
      new NextResponse(zipStream);

    response.headers.set(
      "Content-Type",
      "application/zip"
    );

    response.headers.set(
      "Content-Disposition",
      `attachment; filename="${cleanVoucherNumber}.zip"`
    );

    response.headers.set(
      "Cache-Control",
      "no-store"
    );

    response.headers.set(
      "X-Voucher-Number",
      cleanVoucherNumber
    );

    response.headers.set(
      "X-Total-Files",
      String(files.length)
    );

    return response;
  } catch (error) {
    console.error(
      "Single voucher download error:",
      error
    );

    // =====================================================
    // MARK UNEXPECTED FAILURE
    // =====================================================

    if (
      processingRecordCreated &&
      jobId
    ) {
      try {
        await updateProcessingRecord(
          jobId,
          {
            totalInvoices: 1,
            successfulInvoices: 0,
            failedInvoices: 1,
            duplicateInvoices: 0,
            totalFiles: 0,
            status: "FAILED",
            errorMessage:
              "INTERNAL_SERVER_ERROR",
          }
        );
      } catch (updateError) {
        console.error(
          "Failed to update single voucher processing record:",
          updateError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message:
          "Unable to retrieve voucher documents",
      },
      { status: 500 }
    );
  }
}