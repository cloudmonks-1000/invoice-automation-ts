import { PassThrough, Readable } from "node:stream";
import { ZipArchive } from "archiver";

export interface ZipFileInput {
  folderName: string;
  fileName: string;
  fileData: Buffer;
}

const MAX_ZIP_FILES = 10000;
const MAX_TOTAL_FILE_SIZE = 512 * 1024 * 1024;

/**
 * Sanitizes a file name so that:
 * - path traversal is removed
 * - Windows/Linux unsafe characters are replaced
 * - empty names get a safe fallback
 */
function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.trim();

  if (!cleaned) {
    return "file";
  }

  return cleaned.replace(
    /[<>:"|?*\x00-\x1F]/g,
    "_"
  );
}

/**
 * Sanitizes voucher folder names.
 */
function sanitizeFolderName(
  folderName: string
): string {
  const cleaned = folderName
    .trim()
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    );

  return cleaned || "unknown";
}

/**
 * Prevents duplicate file names inside the same voucher folder.
 */
function getUniqueFileName(
  fileName: string,
  usedNames: Set<string>
): string {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }

  const lastDotIndex =
    fileName.lastIndexOf(".");

  const baseName =
    lastDotIndex > 0
      ? fileName.substring(
          0,
          lastDotIndex
        )
      : fileName;

  const extension =
    lastDotIndex > 0
      ? fileName.substring(
          lastDotIndex
        )
      : "";

  let counter = 2;

  let uniqueName =
    `${baseName}_${counter}${extension}`;

  while (usedNames.has(uniqueName)) {
    counter++;

    uniqueName =
      `${baseName}_${counter}${extension}`;
  }

  usedNames.add(uniqueName);

  return uniqueName;
}

/**
 * Creates a ZIP stream from voucher files.
 *
 * Security limits:
 * - Maximum 10,000 files
 * - Maximum 512 MB total uncompressed input data
 * - Sanitized folder names
 * - Sanitized file names
 * - Duplicate file names are renamed safely
 */
export function createVoucherZip(
  files: ZipFileInput[]
): ReadableStream<Uint8Array> {
  // --------------------------------------------------
  // 1. Maximum file count
  // --------------------------------------------------

  if (files.length > MAX_ZIP_FILES) {
    throw new Error(
      "TOO_MANY_ZIP_FILES"
    );
  }

  // --------------------------------------------------
  // 2. Maximum total input size
  // --------------------------------------------------

  const totalFileSize =
    files.reduce(
      (total, file) =>
        total + file.fileData.length,
      0
    );

  if (
    totalFileSize >
    MAX_TOTAL_FILE_SIZE
  ) {
    throw new Error(
      "ZIP_CONTENT_TOO_LARGE"
    );
  }

  // --------------------------------------------------
  // 3. Create ZIP archive
  // --------------------------------------------------

  const archive = new ZipArchive({
    zlib: {
      level: 6,
    },
  });

  const output =
    new PassThrough();

  archive.pipe(output);

  // --------------------------------------------------
  // 4. Handle ZIP errors
  // --------------------------------------------------

  archive.on(
    "error",
    (error: Error) => {
      output.destroy(error);
    }
  );

  // --------------------------------------------------
  // 5. Track file names per voucher folder
  // --------------------------------------------------

  const usedNamesByFolder =
    new Map<string, Set<string>>();

  // --------------------------------------------------
  // 6. Add files to ZIP
  // --------------------------------------------------

  for (const file of files) {
    const folderName =
      sanitizeFolderName(
        file.folderName
      );

    let usedNames =
      usedNamesByFolder.get(
        folderName
      );

    if (!usedNames) {
      usedNames =
        new Set<string>();

      usedNamesByFolder.set(
        folderName,
        usedNames
      );
    }

    const safeFileName =
      sanitizeFileName(
        file.fileName
      );

    const uniqueFileName =
      getUniqueFileName(
        safeFileName,
        usedNames
      );

    archive.append(
      file.fileData,
      {
        name:
          `${folderName}/${uniqueFileName}`,
      }
    );
  }

  // --------------------------------------------------
  // 7. Finalize ZIP
  // --------------------------------------------------

  archive.finalize();

  // --------------------------------------------------
  // 8. Return Web ReadableStream
  // --------------------------------------------------

  return Readable.toWeb(
    output
  ) as ReadableStream<Uint8Array>;
}