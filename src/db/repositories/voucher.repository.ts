import oracledb from "oracledb";

import { getOracleConnection } from "@/src/db/oracle";

export interface VoucherFile {
  voucherNumber: string;
  fileName: string;
  fileData: Buffer;
  serialNumber: number | null;
}

const ORACLE_VOUCHER_CHUNK_SIZE = 500;

export async function findFilesByVoucherNumbers(
  voucherNumbers: string[]
): Promise<VoucherFile[]> {
  if (voucherNumbers.length === 0) {
    return [];
  }

  const uniqueVoucherNumbers = Array.from(
    new Set(
      voucherNumbers
        .map((voucherNumber) => String(voucherNumber).trim())
        .filter(Boolean)
    )
  );

  if (uniqueVoucherNumbers.length === 0) {
    return [];
  }

  let oracleConnection: oracledb.Connection | undefined;

  try {
    oracleConnection = await getOracleConnection();

    const oracleFiles: VoucherFile[] = [];

    for (
      let start = 0;
      start < uniqueVoucherNumbers.length;
      start += ORACLE_VOUCHER_CHUNK_SIZE
    ) {
      const voucherChunk = uniqueVoucherNumbers.slice(
        start,
        start + ORACLE_VOUCHER_CHUNK_SIZE
      );

      const bindParameters = Object.fromEntries(
        voucherChunk.map((voucherNumber, index) => [
          `voucher${index}`,
          voucherNumber,
        ])
      );

      const bindPlaceholders = voucherChunk
        .map((_, index) => `:voucher${index}`)
        .join(", ");

      const oracleResult = await oracleConnection.execute<{
        VOUCHER_NUMBER: string;
        FILE_NAME: string;
        FILE_DATA: Buffer | null;
        S_NO: number | null;
      }>(
        `
          SELECT
            VOUCHER_NUMBER,
            FILE_NAME,
            FILE_DATA,
            S_NO
          FROM INVC_INVOICE_FILES
          WHERE VOUCHER_NUMBER IN (
            SELECT COLUMN_VALUE
            FROM TABLE(
              SYS.ODCIVARCHAR2LIST(
                ${bindPlaceholders}
              )
            )
          )
          ORDER BY
            VOUCHER_NUMBER,
            S_NO,
            FILE_NAME
        `,
        bindParameters,
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,

          fetchInfo: {
            FILE_DATA: {
              type: oracledb.BUFFER,
            },
          },
        }
      );

      for (const row of oracleResult.rows ?? []) {
        let fileData: Buffer;

        /*
         * IMPORTANT:
         *
         * FILE_DATA NULL hone par file ko skip nahi karna hai.
         * ZIP ke andar filename ke saath empty/0-byte file
         * create karni hai.
         */
        if (
          row.FILE_DATA === null ||
          row.FILE_DATA === undefined
        ) {
          fileData = Buffer.alloc(0);

          console.warn(
            "Oracle FILE_DATA is NULL. Adding empty file to ZIP:",
            {
              voucherNumber: row.VOUCHER_NUMBER,
              fileName: row.FILE_NAME,
              serialNumber: row.S_NO,
            }
          );
        } else {
          fileData = Buffer.isBuffer(row.FILE_DATA)
            ? row.FILE_DATA
            : Buffer.from(row.FILE_DATA);

          /*
           * BLOB exists but has 0 bytes.
           * Is file ko bhi skip nahi karna hai.
           */
          if (fileData.length === 0) {
            console.warn(
              "Oracle FILE_DATA is empty. Adding empty file to ZIP:",
              {
                voucherNumber: row.VOUCHER_NUMBER,
                fileName: row.FILE_NAME,
                serialNumber: row.S_NO,
              }
            );
          } else {
            console.log("Oracle PDF loaded:", {
              voucherNumber: row.VOUCHER_NUMBER,
              fileName: row.FILE_NAME,
              size: fileData.length,
              serialNumber: row.S_NO,
            });
          }
        }

        /*
         * IMPORTANT:
         *
         * Har database row ko oracleFiles mein add karna hai.
         * Chahe fileData actual PDF ho ya empty Buffer.
         */
        oracleFiles.push({
          voucherNumber: row.VOUCHER_NUMBER,
          fileName: row.FILE_NAME,
          fileData,
          serialNumber:
            row.S_NO === null || row.S_NO === undefined
              ? null
              : Number(row.S_NO),
        });
      }
    }

    console.log(
      "Total voucher files including empty files:",
      oracleFiles.length
    );

    return oracleFiles;
  } catch (error) {
    console.error(
      "Oracle findFilesByVoucherNumbers failed:",
      error
    );

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