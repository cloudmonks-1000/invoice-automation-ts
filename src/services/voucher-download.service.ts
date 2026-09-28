import {
  findFilesByVoucherNumbers,
  VoucherFile,
} from "@/src/db/repositories/voucher.repository";

import {
  createVoucherZip,
  ZipFileInput,
} from "@/src/utils/zip";

export interface VoucherFiles {
  voucherNumber: string;
  files: VoucherFile[];
}

export async function getVoucherFiles(
  voucherNumbers: string[]
): Promise<VoucherFiles[]> {
  const uniqueVoucherNumbers = [
    ...new Set(
      voucherNumbers
        .map((voucherNumber) => voucherNumber.trim())
        .filter(Boolean)
    ),
  ];

  if (uniqueVoucherNumbers.length === 0) {
    return [];
  }

  const files = await findFilesByVoucherNumbers(
    uniqueVoucherNumbers
  );

  const grouped = new Map<
    string,
    VoucherFile[]
  >();

  for (const file of files) {
    const existing = grouped.get(
      file.voucherNumber
    );

    if (existing) {
      existing.push(file);
    } else {
      grouped.set(file.voucherNumber, [file]);
    }
  }

  return uniqueVoucherNumbers.map(
    (voucherNumber) => ({
      voucherNumber,
      files:
        grouped.get(voucherNumber) ?? [],
    })
  );
}

export function createVoucherZipStream(
  vouchers: VoucherFiles[]
): ReadableStream<Uint8Array> {
  const zipFiles: ZipFileInput[] = [];

  for (const voucher of vouchers) {
    for (const file of voucher.files) {
      zipFiles.push({
        folderName: voucher.voucherNumber,
        fileName: file.fileName,
        fileData: file.fileData,
      });
    }
  }

  return createVoucherZip(zipFiles);
}