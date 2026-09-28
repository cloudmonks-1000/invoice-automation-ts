import oracledb from "oracledb";

import { getOracleConnection } from "@/src/db/oracle";

export interface CreateRecordInput {
  jobId: string;
  userId?: number | null;
  sourceFileName?: string | null;
  sourceFileType?: string | null;
  processingType?: "BULK" | "SINGLE";
  voucherNumber?: string | null;
}

export interface UpdateRecordInput {
  totalInvoices: number;
  successfulInvoices: number;
  failedInvoices: number;
  duplicateInvoices: number;
  totalFiles: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  errorMessage?: string | null;
}

export async function createProcessingRecord(
  input: CreateRecordInput
) {
  let oracleConnection;

  try {
    oracleConnection =
      await getOracleConnection();

    const processingType =
      input.processingType ?? "BULK";

    /*
     * INVC_RECORDS.VOUCHER_NUMBER is NOT NULL.
     *
     * SINGLE:
     *   actual voucher number
     *
     * BULK:
     *   no single voucher exists, so store N/A
     */
    const voucherNumber =
      input.voucherNumber?.trim() ||
      "N/A";

    await oracleConnection.execute(
      `
        INSERT INTO INVC_RECORDS (
          JOB_ID,
          USER_ID,
          SOURCE_FILE_NAME,
          SOURCE_FILE_TYPE,
          PROCESSING_TYPE,
          VOUCHER_NUMBER,
          STATUS,
          STARTED_AT,
          CREATED_AT,
          UPDATED_AT
        )
        VALUES (
          :jobId,
          :userId,
          :sourceFileName,
          :sourceFileType,
          :processingType,
          :voucherNumber,
          'PROCESSING',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `,
      {
        jobId: input.jobId,

        userId:
          input.userId ?? null,

        sourceFileName:
          input.sourceFileName?.trim() ||
          "N/A",

        sourceFileType:
          input.sourceFileType?.trim() ||
          (processingType === "SINGLE"
            ? "SINGLE_VOUCHER"
            : "BULK"),

        processingType,

        voucherNumber,
      }
    );

    await oracleConnection.commit();

    const result =
      await oracleConnection.execute<{
        RECORD_ID: number;
        JOB_ID: string;
        STATUS: string;
        STARTED_AT: Date;
      }>(
        `
          SELECT
            RECORD_ID,
            JOB_ID,
            STATUS,
            STARTED_AT
          FROM INVC_RECORDS
          WHERE JOB_ID = :jobId
          FETCH FIRST 1 ROW ONLY
        `,
        {
          jobId: input.jobId,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const row = result.rows?.[0];

    if (!row) {
      throw new Error(
        "PROCESSING_RECORD_NOT_FOUND"
      );
    }

    return {
      record_id: Number(
        row.RECORD_ID
      ),

      job_id:
        row.JOB_ID,

      status:
        row.STATUS,

      started_at:
        row.STARTED_AT,
    };
  } catch (error) {
    console.error(
      "Oracle createProcessingRecord failed:",
      error
    );

    if (oracleConnection) {
      try {
        await oracleConnection.rollback();
      } catch (rollbackError) {
        console.error(
          "Oracle createProcessingRecord rollback failed:",
          rollbackError
        );
      }
    }

    throw error;
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

export async function updateProcessingRecord(
  jobId: string,
  input: UpdateRecordInput
) {
  let oracleConnection;

  try {
    oracleConnection =
      await getOracleConnection();

    const updateResult =
      await oracleConnection.execute(
        `
          UPDATE INVC_RECORDS
          SET
            TOTAL_INVOICES = :totalInvoices,
            SUCCESSFUL_INVOICES = :successfulInvoices,
            FAILED_INVOICES = :failedInvoices,
            DUPLICATE_INVOICES = :duplicateInvoices,
            TOTAL_FILES = :totalFiles,
            STATUS = :status,
            ERROR_MESSAGE = :errorMessage,
            COMPLETED_AT = CURRENT_TIMESTAMP,
            UPDATED_AT = CURRENT_TIMESTAMP
          WHERE JOB_ID = :jobId
        `,
        {
          jobId,

          totalInvoices:
            input.totalInvoices,

          successfulInvoices:
            input.successfulInvoices,

          failedInvoices:
            input.failedInvoices,

          duplicateInvoices:
            input.duplicateInvoices,

          totalFiles:
            input.totalFiles,

          status:
            input.status,

          /*
           * ERROR_MESSAGE is also NOT NULL
           */
          errorMessage:
            input.errorMessage?.trim() ||
            "NONE",
        }
      );

    if (
      updateResult.rowsAffected === 0
    ) {
      await oracleConnection.rollback();
      return null;
    }

    await oracleConnection.commit();

    const result =
      await oracleConnection.execute<{
        RECORD_ID: number;
        JOB_ID: string;
        STATUS: string;
        TOTAL_INVOICES: number;
        SUCCESSFUL_INVOICES: number;
        FAILED_INVOICES: number;
        DUPLICATE_INVOICES: number;
        TOTAL_FILES: number;
        COMPLETED_AT: Date;
      }>(
        `
          SELECT
            RECORD_ID,
            JOB_ID,
            STATUS,
            TOTAL_INVOICES,
            SUCCESSFUL_INVOICES,
            FAILED_INVOICES,
            DUPLICATE_INVOICES,
            TOTAL_FILES,
            COMPLETED_AT
          FROM INVC_RECORDS
          WHERE JOB_ID = :jobId
          FETCH FIRST 1 ROW ONLY
        `,
        {
          jobId,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const row = result.rows?.[0];

    if (!row) {
      throw new Error(
        "PROCESSING_RECORD_NOT_FOUND"
      );
    }

    return {
      record_id: Number(
        row.RECORD_ID
      ),

      job_id:
        row.JOB_ID,

      status:
        row.STATUS,

      total_invoices: Number(
        row.TOTAL_INVOICES ?? 0
      ),

      successful_invoices: Number(
        row.SUCCESSFUL_INVOICES ?? 0
      ),

      failed_invoices: Number(
        row.FAILED_INVOICES ?? 0
      ),

      duplicate_invoices: Number(
        row.DUPLICATE_INVOICES ?? 0
      ),

      total_files: Number(
        row.TOTAL_FILES ?? 0
      ),

      completed_at:
        row.COMPLETED_AT ?? null,
    };
  } catch (error) {
    console.error(
      "Oracle updateProcessingRecord failed:",
      error
    );

    if (oracleConnection) {
      try {
        await oracleConnection.rollback();
      } catch (rollbackError) {
        console.error(
          "Oracle updateProcessingRecord rollback failed:",
          rollbackError
        );
      }
    }

    throw error;
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