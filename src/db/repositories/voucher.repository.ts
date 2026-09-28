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

  const uniqueVoucherNumbers =
    Array.from(
      new Set(
        voucherNumbers.map(
          (voucherNumber) =>
            String(voucherNumber).trim()
        )
      )
    ).filter(Boolean);

  if (uniqueVoucherNumbers.length === 0) {
    return [];
  }

  let oracleConnection;

  try {
    oracleConnection =
      await getOracleConnection();

    const oracleFiles: VoucherFile[] = [];

    /*
     * Process vouchers in chunks so that
     * Oracle bind/SQL limits are not exceeded.
     */
    for (
      let start = 0;
      start <
      uniqueVoucherNumbers.length;
      start += ORACLE_VOUCHER_CHUNK_SIZE
    ) {
      const voucherChunk =
        uniqueVoucherNumbers.slice(
          start,
          start +
            ORACLE_VOUCHER_CHUNK_SIZE
        );

      const bindParameters =
        Object.fromEntries(
          voucherChunk.map(
            (
              voucherNumber,
              index
            ) => [
              `voucher${index}`,
              voucherNumber,
            ]
          )
        );

      const bindPlaceholders =
        voucherChunk
          .map(
            (_, index) =>
              `:voucher${index}`
          )
          .join(", ");

      const oracleResult =
        await oracleConnection.execute<{
          VOUCHER_NUMBER: string;
          FILE_NAME: string;
          FILE_DATA: Buffer;
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
            outFormat:
              oracledb.OUT_FORMAT_OBJECT,

            fetchInfo: {
              FILE_DATA: {
                type: oracledb.BUFFER,
              },
            },
          }
        );

      for (
        const row of
        oracleResult.rows ?? []
      ) {
        oracleFiles.push({
          voucherNumber:
            row.VOUCHER_NUMBER,

          fileName:
            row.FILE_NAME,

          fileData:
            Buffer.isBuffer(
              row.FILE_DATA
            )
              ? row.FILE_DATA
              : Buffer.from(
                  row.FILE_DATA
                ),

          serialNumber:
            row.S_NO === null ||
            row.S_NO === undefined
              ? null
              : Number(row.S_NO),
        });
      }
    }

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