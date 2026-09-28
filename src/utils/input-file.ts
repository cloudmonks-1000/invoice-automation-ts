import * as XLSX from "xlsx";

export interface ParsedInputFile {
  voucherNumbers: string[];
  fileType: "csv" | "xlsx" | "xls";
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MAX_FILE_NAME_LENGTH = 255;
const MAX_ROWS = 10000;

/**
 * Supported file extension.
 */
function getFileType(
  fileName: string
): ParsedInputFile["fileType"] {
  const extension = fileName
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();

  switch (extension) {
    case "csv":
      return "csv";

    case "xlsx":
      return "xlsx";

    case "xls":
      return "xls";

    default:
      throw new Error(
        "UNSUPPORTED_FILE_TYPE"
      );
  }
}

/**
 * Makes header comparison highly tolerant.
 *
 * Examples:
 *
 * VOUCHER_NUMBER -> voucher_number
 * Voucher_Number -> voucher_number
 * Voucher Number  -> voucher_number
 * voucher-number  -> voucher_number
 * voucher number  -> voucher_number
 *  VOUCHER_NUMBER  -> voucher_number
 */
function normalizeHeader(
  value: unknown
): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Detects whether a header represents voucher_number.
 */
function isVoucherNumberHeader(
  value: unknown
): boolean {
  const normalized =
    normalizeHeader(value);

  return (
    normalized ===
    "vouchernumber"
  );
}

/**
 * Converts Excel/CSV cell value to a clean voucher number.
 *
 * Handles:
 * - normal strings
 * - numbers
 * - Excel numeric values
 * - spaces
 * - accidental decimal .0
 * - scientific notation where possible
 */
function normalizeVoucherValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  let result = String(value)
    .replace(/\u00A0/g, " ")
    .trim();

  if (!result) {
    return "";
  }

  /**
   * Excel sometimes converts integer-like
   * values to:
   *
   * 251213575.0
   */
  if (
    /^\d+\.0+$/.test(result)
  ) {
    result =
      result.split(".")[0] ?? result;
  }

  return result;
}

/**
 * Reads workbook and returns first worksheet.
 */
function getFirstWorksheet(
  workbook: XLSX.WorkBook
): XLSX.WorkSheet {
  if (
    workbook.SheetNames.length === 0
  ) {
    throw new Error(
      "EMPTY_WORKBOOK"
    );
  }

  const firstSheetName =
    workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error(
      "EMPTY_WORKBOOK"
    );
  }

  const worksheet =
    workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error(
      "EMPTY_WORKSHEET"
    );
  }

  return worksheet;
}

/**
 * Finds voucher_number column dynamically.
 *
 * It does NOT care:
 * - which column number it is
 * - how many other columns exist
 * - uppercase/lowercase
 * - spaces
 * - underscore
 * - hyphen
 */
function findVoucherColumnIndex(
  headerRow: unknown[]
): number {
  return headerRow.findIndex(
    (header) =>
      isVoucherNumberHeader(header)
  );
}

/**
 * Parses CSV / XLSX / XLS.
 */
export async function parseInputFile(
  file: File
): Promise<ParsedInputFile> {
  if (!file) {
    throw new Error(
      "INPUT_FILE_REQUIRED"
    );
  }

  if (!file.name || !file.name.trim()) {
  throw new Error(
    "INVALID_FILE_NAME"
  );
}

if (file.name.length > MAX_FILE_NAME_LENGTH) {
  throw new Error(
    "FILE_NAME_TOO_LONG"
  );
}


  if (file.size === 0) {
    throw new Error(
      "EMPTY_FILE"
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      "FILE_TOO_LARGE"
    );
  }

  const fileType =
    getFileType(file.name);

  let workbook: XLSX.WorkBook;

  // =====================================================
  // CSV
  // =====================================================

  if (fileType === "csv") {
    const text =
      await file.text();

    workbook = XLSX.read(text, {
      type: "string",
      raw: false,
    });
  }

  // =====================================================
  // XLSX / XLS
  // =====================================================

  else {
    const arrayBuffer =
      await file.arrayBuffer();

    workbook = XLSX.read(
      arrayBuffer,
      {
        type: "array",
        raw: false,
        cellDates: false,
      }
    );
  }

  // =====================================================
  // GET FIRST SHEET
  // =====================================================

  const worksheet =
    getFirstWorksheet(workbook);

  // =====================================================
  // CONVERT SHEET TO ROWS
  // =====================================================

  const rows =
    XLSX.utils.sheet_to_json<
      unknown[]
    >(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    if (rows.length > MAX_ROWS + 1) {
  throw new Error(
    "TOO_MANY_ROWS"
  );
}


  if (rows.length === 0) {
    throw new Error(
      "EMPTY_WORKSHEET"
    );
  }

  // =====================================================
  // FIND HEADER
  // =====================================================

  const headerRow =
    rows[0] ?? [];

  const voucherColumnIndex =
    findVoucherColumnIndex(
      headerRow
    );

  // =====================================================
  // HEADER NOT FOUND
  // =====================================================

  if (voucherColumnIndex === -1) {
    throw new Error(
      "INVALID_INPUT_HEADER"
    );
  }

  // =====================================================
  // READ VOUCHER VALUES
  // =====================================================

  const voucherNumbers =
    rows
      .slice(1)
      .map((row) => {
        const value =
          row?.[
            voucherColumnIndex
          ];

        return normalizeVoucherValue(
          value
        );
      })
      .filter(Boolean);

  // =====================================================
  // NO VALUES
  // =====================================================

  if (
    voucherNumbers.length === 0
  ) {
    throw new Error(
      "NO_VOUCHER_NUMBERS"
    );
  }

  // =====================================================
  // REMOVE DUPLICATES
  // =====================================================

  const uniqueVoucherNumbers =
    [
      ...new Set(
        voucherNumbers
      ),
    ];

  return {
    voucherNumbers:
      uniqueVoucherNumbers,
    fileType,
  };
}