"use client";

import {
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

import Sidebar from "./components/Sidebar";
import Dashboard from "./ui-pages/Dashboard";
import Summary from "./ui-pages/Summary";
import History from "./ui-pages/History";

interface Invoice {
  invoice_number: string;
  voucher_number: string;
  total_files: number;
  file_name: string;
  file_size: number;
}

interface FileResult {
  filename: string;
  fileSize: number;
}

interface BulkResult {
  totalVouchers: number;
  successfulVouchers: number;
  missingVouchers: number;
  totalFiles: number;
  totalCount: number;
  successfulCount: number;
  failedCount: number;
  duplicateCount: number;
  errorReport: boolean;
}

interface ErrorDetailItem {
  msg?: string;
  [key: string]: unknown;
}

interface ErrorData {
  detail?:
    | string
    | ErrorDetailItem[]
    | {
        message?: string;
        [key: string]: unknown;
      };
  message?: string;
}

function formatAmount(
  value: string | number | null | undefined,
  currency = "INR"
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return `${currency} ${Number(value).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function App() {
  const router = useRouter();

  // =====================================================
  // CURRENT PAGE
  // =====================================================

  const [currentPage, setCurrentPage] =
    useState<string>("processing");

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async (): Promise<void> => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  // =====================================================
  // SINGLE INVOICE STATE
  // =====================================================

  const [invoiceNumber, setInvoiceNumber] =
    useState<string>("");

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [loading, setLoading] =
    useState<boolean>(false);

  // =====================================================
  // BULK FILE PROCESSING STATE
  // =====================================================

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [fileLoading, setFileLoading] =
    useState<boolean>(false);

  const [fileResult, setFileResult] =
    useState<FileResult | null>(null);

  // =====================================================
  // COMMON BULK RESULT
  // =====================================================

  const [bulkResult, setBulkResult] =
    useState<BulkResult | null>(null);

  // =====================================================
  // COMMON MESSAGE
  // =====================================================

  const [message, setMessage] =
    useState<string>("");

  // =====================================================
  // ERROR MESSAGE HELPER
  // =====================================================

  const getErrorMessage = (
    errorData: ErrorData | null,
    fallbackMessage: string
  ): string => {
    if (!errorData) {
      return fallbackMessage;
    }

    if (typeof errorData.detail === "string") {
      return errorData.detail;
    }

    if (Array.isArray(errorData.detail)) {
      return errorData.detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          if (item?.msg) {
            return item.msg;
          }

          return JSON.stringify(item);
        })
        .join(", ");
    }

    if (
      errorData.detail &&
      typeof errorData.detail === "object"
    ) {
      if (errorData.detail.message) {
        return errorData.detail.message;
      }

      return JSON.stringify(errorData.detail);
    }

    if (typeof errorData.message === "string") {
      return errorData.message;
    }

    return fallbackMessage;
  };

  // =====================================================
  // READ BULK RESULT HEADERS
  // =====================================================

  const getBulkResultFromHeaders = (
    response: Response
  ): BulkResult => {
    const totalVouchers = Number(
      response.headers.get("X-Total-Vouchers") || 0
    );

    const successfulVouchers = Number(
      response.headers.get("X-Successful-Vouchers") || 0
    );

    const missingVouchers = Number(
      response.headers.get("X-Missing-Vouchers") || 0
    );

    const totalFiles = Number(
      response.headers.get("X-Total-Files") || 0
    );

    return {
      totalVouchers,
      successfulVouchers,
      missingVouchers,
      totalFiles,
      totalCount: totalVouchers,
      successfulCount: successfulVouchers,
      failedCount: missingVouchers,
      duplicateCount: 0,
      errorReport: false,
    };
  };

  // =====================================================
  // GET ZIP FILENAME
  // =====================================================

  const getFilenameFromResponse = (
    response: Response,
    defaultFilename: string
  ): string => {
    let filename = defaultFilename;

    const contentDisposition =
      response.headers.get("Content-Disposition");

    if (contentDisposition) {
      const filenameMatch =
        contentDisposition.match(
          /filename\*?=(?:UTF-8'')?["']?([^;"']+)["']?/i
        );

      if (filenameMatch?.[1]) {
        try {
          filename = decodeURIComponent(
            filenameMatch[1]
          );
        } catch {
          filename = filenameMatch[1];
        }
      }
    }

    return filename;
  };

  // =====================================================
  // DOWNLOAD BLOB
  // =====================================================

  const downloadBlob = (
    blob: Blob,
    filename: string
  ): void => {
    const downloadUrl =
      window.URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = downloadUrl;
    link.download = filename;

    document.body.appendChild(link);

    link.click();
    link.remove();

    window.URL.revokeObjectURL(downloadUrl);
  };

  // =====================================================
  // SINGLE INVOICE SEARCH
  // =====================================================

  const searchInvoice = async (): Promise<void> => {
    if (!invoiceNumber.trim()) {
      setMessage(
        "Please enter an invoice number."
      );
      return;
    }

    setLoading(true);
    setMessage("");
    setInvoice(null);

    try {
      const voucherNumber =
        invoiceNumber.trim();

      const response =
        await fetch(
          `/api/invoices/${encodeURIComponent(
            voucherNumber
          )}`
        );

      if (!response.ok) {
        let errorMessage =
          "Invoice not found.";

        try {
          const errorData =
            await response.json();

          errorMessage =
            getErrorMessage(
              errorData,
              errorMessage
            );
        } catch {
          // Response was not JSON
        }

        throw new Error(errorMessage);
      }

      const blob =
        await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error(
          "The server returned an empty document."
        );
      }

      const totalFiles = Number(
        response.headers.get(
          "X-Total-Files"
        ) || 1
      );

      const contentDisposition =
        response.headers.get(
          "Content-Disposition"
        ) || "";

      let filename =
        totalFiles > 1
          ? `${voucherNumber}.zip`
          : `${voucherNumber}.pdf`;

      const filenameMatch =
        contentDisposition.match(
          /filename="([^"]+)"/i
        );

      if (filenameMatch?.[1]) {
        filename =
          filenameMatch[1];
      }

      setInvoice({
        invoice_number:
          voucherNumber,
        voucher_number:
          voucherNumber,
        total_files:
          totalFiles,
        file_name:
          filename,
        file_size:
          blob.size,
      });

      downloadBlob(
        blob,
        filename
      );

      if (totalFiles > 1) {
        setMessage(
          `${totalFiles} invoice documents found. ZIP download started.`
        );
      } else {
        setMessage(
          "Invoice document found. PDF download started."
        );
      }
    } catch (error) {
      console.error(
        "Invoice search error:",
        error
      );

      setInvoice(null);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to retrieve invoice."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // GENERATE SINGLE PDF
  // =====================================================

  const generatePdf = async (): Promise<void> => {
    if (!invoice) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response =
        await fetch(
          `/api/invoices/${encodeURIComponent(
            invoice.invoice_number
          )}/generate`,
          {
            method: "POST",
          }
        );

      if (!response.ok) {
        let errorMessage =
          "PDF generation failed.";

        try {
          const errorData =
            await response.json();

          errorMessage =
            getErrorMessage(
              errorData,
              errorMessage
            );
        } catch {
          // Ignore response parsing errors
        }

        throw new Error(errorMessage);
      }

      setMessage(
        "Invoice PDF generated successfully."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "PDF generation failed."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // DOWNLOAD SINGLE PDF
  // =====================================================

  const downloadPdf = (): void => {
    if (!invoice) {
      return;
    }

    window.open(
      `/api/invoices/${encodeURIComponent(
        invoice.invoice_number
      )}/download`,
      "_blank"
    );
  };

  // =====================================================
  // SELECT BULK FILE
  // =====================================================

  const handleFileSelect = (
    event: ChangeEvent<HTMLInputElement>
  ): void => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const fileName =
      file.name.toLowerCase();

    const isExcel =
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls");

    const isCsv =
      fileName.endsWith(".csv");

    if (!isExcel && !isCsv) {
      setSelectedFile(null);
      setBulkResult(null);

      setMessage(
        "Invalid file type. Please upload an Excel or CSV file."
      );

      event.target.value = "";

      return;
    }

    setSelectedFile(file);
    setFileResult(null);
    setBulkResult(null);
    setMessage("");
  };

  // =====================================================
  // REMOVE SELECTED FILE
  // =====================================================

  const removeSelectedFile =
    (): void => {
      setSelectedFile(null);
      setFileResult(null);
      setBulkResult(null);
      setMessage("");

      const fileInput =
        document.getElementById(
          "bulkInvoiceFile"
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
    };

  // =====================================================
  // BULK FILE PROCESSING
  // =====================================================

  const processBulkFile =
    async (): Promise<void> => {
      if (!selectedFile) {
        setMessage(
          "Please select an Excel or CSV file first."
        );

        return;
      }

      setFileLoading(true);
      setFileResult(null);
      setBulkResult(null);
      setMessage("");

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          selectedFile
        );

        const response =
          await fetch(
            "/api/invoices/bulk/upload",
            {
              method: "POST",
              body: formData,
            }
          );

        // =================================================
        // BACKEND ERROR
        // =================================================

        if (!response.ok) {
          let errorMessage =
            "Bulk voucher processing failed.";

          const contentType =
            response.headers.get(
              "content-type"
            ) || "";

          try {
            if (
              contentType.includes(
                "application/json"
              )
            ) {
              const errorData =
                await response.json();

              errorMessage =
                getErrorMessage(
                  errorData,
                  errorMessage
                );
            } else {
              const text =
                await response.text();

              if (text) {
                errorMessage = text;
              }
            }
          } catch {
            // Ignore response parsing errors
          }

          throw new Error(
            errorMessage
          );
        }

        // =================================================
        // PROCESSING STATISTICS
        // =================================================

        const result =
          getBulkResultFromHeaders(
            response
          );

        setBulkResult(result);

        // =================================================
        // ZIP RESPONSE
        // =================================================

        const blob =
          await response.blob();

        if (
          !blob ||
          blob.size === 0
        ) {
          throw new Error(
            "The server returned an empty ZIP file."
          );
        }

        // =================================================
        // ZIP FILENAME
        // =================================================

        const filename =
          getFilenameFromResponse(
            response,
            "vouchers.zip"
          );

        // =================================================
        // DOWNLOAD ZIP
        // =================================================

        downloadBlob(
          blob,
          filename
        );

        // =================================================
        // SAVE RESULT
        // =================================================

        setFileResult({
          filename,
          fileSize: blob.size,
        });

        // =================================================
        // MESSAGE
        // =================================================

        if (
          result.missingVouchers > 0
        ) {
          setMessage(
            `Voucher processing completed. ${result.missingVouchers} voucher(s) had no files in the database.`
          );
        } else {
          setMessage(
            "Voucher files retrieved successfully and ZIP download started."
          );
        }
      } catch (error) {
        console.error(
          "Bulk processing error:",
          error
        );

        setFileResult(null);
        setBulkResult(null);

        setMessage(
          error instanceof Error
            ? error.message
            : "Bulk voucher processing failed."
        );
      } finally {
        setFileLoading(false);
      }
    };

  // =====================================================
  // FORMAT FILE SIZE
  // =====================================================

  const formatFileSize = (
    bytes: number
  ): string => {
    if (!bytes) {
      return "0 KB";
    }

    const kb =
      bytes / 1024;

    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    return `${(
      kb / 1024
    ).toFixed(1)} MB`;
  };

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  return (
    <div className="flex min-h-screen w-full bg-slate-100">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
      />

      <div className="min-w-0 flex-1">
        <div className="min-h-screen bg-slate-100">

          {/* =================================================
              HEADER
          ================================================= */}

          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-7">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                  S
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    Sify Technologies
                  </p>

                  <p className="truncate text-[10px] text-slate-500">
                    Invoice Automation
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

              <span className="text-[10px] font-semibold text-emerald-700">
                System Online
              </span>
            </div>
          </header>

          {/* =================================================
              MAIN
          ================================================= */}

          <main className="px-5 py-6 lg:px-7 lg:py-7">
            <div className="mx-auto w-full max-w-[1500px]">

              {/* =================================================
                  DASHBOARD
              ================================================= */}

              {currentPage === "dashboard" ? (
                <Dashboard />

              ) : currentPage === "summary" ? (
                <Summary />

              ) : currentPage === "history" ? (
                <History />

              ) : (

                <>
                  {/* =================================================
                      PAGE HEADER
                  ================================================= */}

                  <div className="mb-6">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
                          Operations
                        </p>

                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                          Invoice Processing
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                          Search invoice documents or process multiple vouchers.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      SINGLE INVOICE SEARCH
                  ================================================= */}

                  <section className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle
                              cx="11"
                              cy="11"
                              r="7"
                            />
                            <path d="m20 20-4-4" />
                          </svg>
                        </div>

                        <div>
                          <h2 className="text-sm font-bold text-slate-900">
                            Search Invoice
                          </h2>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Enter an invoice or voucher number to retrieve documents.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <label
                          htmlFor="invoiceNumber"
                          className="mb-1.5 block text-[11px] font-semibold text-slate-600"
                        >
                          Invoice Number
                        </label>

                        <input
                          id="invoiceNumber"
                          type="text"
                          placeholder="e.g. INV-2026-001"
                          value={invoiceNumber}
                          onChange={(event) =>
                            setInvoiceNumber(
                              event.target.value
                            )
                          }
                          onKeyDown={(
                            event: KeyboardEvent<HTMLInputElement>
                          ) => {
                            if (
                              event.key === "Enter"
                            ) {
                              searchInvoice();
                            }
                          }}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={searchInvoice}
                        disabled={loading}
                        className="h-10 rounded-lg bg-slate-900 px-5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading
                          ? "Processing..."
                          : "Search Invoice"}
                      </button>
                    </div>
                  </section>

                  {/* =================================================
                      BULK PROCESSING
                  ================================================= */}

                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">

                    {/* =================================================
                        BULK UPLOAD
                    ================================================= */}

                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M12 3v12" />
                                <path d="m7 8 5-5 5 5" />
                                <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                              </svg>
                            </div>

                            <div>
                              <h2 className="text-sm font-bold text-slate-900">
                                Bulk Voucher Download
                              </h2>

                              <p className="mt-0.5 text-xs text-slate-500">
                                Upload an Excel or CSV voucher list.
                              </p>
                            </div>
                          </div>

                          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 sm:inline-flex">
                            Excel / CSV
                          </span>
                        </div>
                      </div>

                      <div className="p-5">

                        {/* Upload */}
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-blue-300 hover:bg-blue-50/30">
                          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                            <svg
                              className="h-5 w-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path d="M12 16V4" />
                              <path d="m7 9 5-5 5 5" />
                              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                            </svg>
                          </div>

                          <h3 className="mt-3 text-sm font-semibold text-slate-800">
                            Upload voucher list
                          </h3>

                          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                            Select an Excel or CSV file containing the{" "}
                            <span className="font-semibold text-slate-700">
                              voucher_number
                            </span>{" "}
                            column.
                          </p>

                          <input
                            id="bulkInvoiceFile"
                            className="hidden"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileSelect}
                          />

                          <label
                            htmlFor="bulkInvoiceFile"
                            className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            Choose File
                          </label>
                        </div>

                        {/* Selected File */}
                        {selectedFile && (
                          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[9px] font-bold text-emerald-700">
                                XLS
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-800">
                                  {selectedFile.name}
                                </p>

                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {formatFileSize(
                                    selectedFile.size
                                  )}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={removeSelectedFile}
                              disabled={fileLoading}
                              className="shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </div>
                        )}

                        {/* Action */}
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={processBulkFile}
                            disabled={
                              !selectedFile ||
                              fileLoading
                            }
                            className="h-10 rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {fileLoading
                              ? "Processing..."
                              : "Process Vouchers"}
                          </button>
                        </div>

                        {/* Processing */}
                        {fileLoading && (
                          <div className="mt-4 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3.5">
                            <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />

                            <div>
                              <p className="text-xs font-semibold text-blue-900">
                                Processing vouchers
                              </p>

                              <p className="mt-0.5 text-[11px] leading-5 text-blue-700">
                                Reading voucher numbers and retrieving documents.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Download Result */}
                        {fileResult &&
                          !fileLoading && (
                            <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3.5">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[9px] font-bold text-emerald-700 shadow-sm">
                                ZIP
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-emerald-900">
                                  {fileResult.filename}
                                </p>

                                <p className="mt-0.5 text-[10px] text-emerald-700">
                                  Download completed ·{" "}
                                  {formatFileSize(
                                    fileResult.fileSize
                                  )}
                                </p>
                              </div>
                            </div>
                          )}
                      </div>
                    </section>

                    {/* =================================================
                        PROCESSING SUMMARY
                    ================================================= */}

                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 px-5 py-4">
                        <h2 className="text-sm font-bold text-slate-900">
                          Processing Summary
                        </h2>

                        <p className="mt-0.5 text-xs text-slate-500">
                          Results from the latest bulk operation.
                        </p>
                      </div>

                      {bulkResult ? (
                        <div className="grid grid-cols-2 gap-px bg-slate-200">
                          <SummaryMetric
                            label="Total Vouchers"
                            value={
                              bulkResult.totalVouchers
                            }
                          />

                          <SummaryMetric
                            label="Processed"
                            value={
                              bulkResult.successfulVouchers
                            }
                          />

                          <SummaryMetric
                            label="Files Retrieved"
                            value={
                              bulkResult.totalFiles
                            }
                          />

                          <SummaryMetric
                            label="Missing"
                            value={
                              bulkResult.missingVouchers
                            }
                            danger={
                              bulkResult.missingVouchers >
                              0
                            }
                          />
                        </div>
                      ) : (
                        <div className="flex min-h-[220px] items-center justify-center p-6 text-center">
                          <div>
                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                              <svg
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path d="M8 6h13" />
                                <path d="M8 12h13" />
                                <path d="M8 18h13" />
                                <path d="M3 6h.01" />
                                <path d="M3 12h.01" />
                                <path d="M3 18h.01" />
                              </svg>
                            </div>

                            <p className="mt-3 text-xs font-semibold text-slate-600">
                              No processing results
                            </p>

                            <p className="mt-1 text-[11px] text-slate-400">
                              Upload and process a voucher list to see results.
                            </p>
                          </div>
                        </div>
                      )}
                    </section>
                  </div>

                  {/* =================================================
                      MESSAGE
                  ================================================= */}

                  {message && (
                    <div className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-700 shadow-sm">
                      {message}
                    </div>
                  )}

                  {/* =================================================
                      INVOICE DETAILS
                  ================================================= */}

                  {invoice && (
                    <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
                        <div>
                          <h2 className="text-sm font-bold text-slate-900">
                            Invoice Documents
                          </h2>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Retrieved document information.
                          </p>
                        </div>

                        <span className="inline-flex w-fit rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                          {invoice.voucher_number}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                        <InvoiceInfo
                          label="Voucher Number"
                          value={
                            invoice.voucher_number
                          }
                        />

                        <InvoiceInfo
                          label="Documents Found"
                          value={String(
                            invoice.total_files
                          )}
                        />

                        <InvoiceInfo
                          label="Download File"
                          value={
                            invoice.file_name
                          }
                        />

                        <InvoiceInfo
                          label="Status"
                          value="Documents Available"
                          success
                        />
                      </div>

                      
                    </section>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// SMALL UI COMPONENTS
// =====================================================

interface SummaryMetricProps {
  label: string;
  value: number;
  danger?: boolean;
}

function SummaryMetric({
  label,
  value,
  danger = false,
}: SummaryMetricProps) {
  return (
    <div className="bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${
          danger
            ? "text-red-600"
            : "text-slate-900"
        }`}
      >
        {value.toLocaleString("en-IN")}
      </p>
    </div>
  );
}

interface InvoiceInfoProps {
  label: string;
  value: string;
  success?: boolean;
}

function InvoiceInfo({
  label,
  value,
  success = false,
}: InvoiceInfoProps) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1.5 truncate text-xs font-semibold ${
          success
            ? "text-emerald-600"
            : "text-slate-800"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export default App;