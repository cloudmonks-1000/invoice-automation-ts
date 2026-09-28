"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");

  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

async function importPublicKey(publicKeyPem: string) {
  const keyData = pemToArrayBuffer(publicKeyPem);

  return window.crypto.subtle.importKey(
    "spki",
    keyData,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

async function encryptPassword(
  password: string,
  publicKeyPem: string
): Promise<string> {
  const publicKey = await importPublicKey(publicKeyPem);
  const encoder = new TextEncoder();

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encoder.encode(password)
  );

  const encryptedBytes = new Uint8Array(encrypted);
  let binary = "";

  for (let i = 0; i < encryptedBytes.length; i++) {
    binary += String.fromCharCode(encryptedBytes[i]);
  }

  return window.btoa(binary);
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] =
    useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const keyResponse = await fetch("/api/auth/login-key", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!keyResponse.ok) {
        throw new Error("Unable to initialize secure login.");
      }

      const publicKeyPem = await keyResponse.text();

      if (!publicKeyPem.includes("BEGIN PUBLIC KEY")) {
        throw new Error("Invalid login security key.");
      }

      const encryptedPassword = await encryptPassword(
        password,
        publicKeyPem
      );

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email: normalizedEmail,
          encryptedPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to login.");
      }

      // Never store password or tokens in localStorage/sessionStorage.
      setPassword("");

      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f9]">
      {/* =========================================================
          FORGOT PASSWORD MODAL
      ========================================================= */}
      {showForgotPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowForgotPasswordModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3
                  id="forgot-password-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Forgot Password?
                </h3>

                <p className="mt-2 text-sm leading-5 text-slate-500">
                  Please contact your system administrator to reset
                  your password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="ml-4 text-xl leading-none text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="rounded-md bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Administrator
              </p>

              <a
                href="mailto:admin@sifyinvoice.com"
                className="mt-1 block text-sm font-semibold text-[#0b1e3d] hover:underline"
              >
                admin@sifyinvoice.com
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(false)}
              className="mt-5 w-full rounded-md bg-[#0b1e3d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f2850]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="grid min-h-screen lg:grid-cols-2">
        {/* =========================================================
            LEFT PANEL — BRAND / CORPORATE IDENTITY
        ========================================================= */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b1e3d] via-[#122a4f] to-[#0b1e3d] px-12 py-14 text-white lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />

          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-lg font-semibold ring-1 ring-white/20">
              S
            </div>

            <span className="text-sm font-semibold tracking-wide text-white/90">
              Sify Technologies
            </span>
          </div>

          <div className="relative max-w-md">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight">
              Invoice Automation Platform
            </h1>

            <p className="mt-4 text-sm leading-6 text-white/70">
              Secure, enterprise-grade document processing for finance
              and accounts-payable teams. Built for accuracy, control
              and compliance at scale.
            </p>

            <ul className="mt-8 space-y-3 text-sm text-white/80">
              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                End-to-end encrypted authentication
              </li>

              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Role-based access control
              </li>

              <li className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Audit-ready processing logs
              </li>
            </ul>
          </div>

          <p className="relative text-xs text-white/40">
            © {new Date().getFullYear()} Sify Technologies. All rights
            reserved.
          </p>
        </div>

        {/* =========================================================
            RIGHT PANEL — SIGN-IN FORM
        ========================================================= */}
        <div className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-[#0b1e3d] text-lg font-semibold text-white">
                A
              </div>

              <p className="text-sm font-semibold tracking-wide text-slate-500">
                Sify Technologies
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Sign in to your account
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Enter your corporate credentials to access the
                platform.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              noValidate
            >
              {/* =====================================================
                  EMAIL
              ===================================================== */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Work email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0b1e3d] focus:ring-2 focus:ring-[#0b1e3d]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>

              {/* =====================================================
                  PASSWORD
              ===================================================== */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    disabled={loading}
                    className="text-xs font-medium text-slate-500 hover:text-[#0b1e3d] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0b1e3d] focus:ring-2 focus:ring-[#0b1e3d]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((prev) => !prev)
                    }
                    disabled={loading}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    aria-pressed={showPassword}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {showPassword ? (
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4.5 w-4.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                        />
                      </svg>
                    ) : (
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4.5 w-4.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                        />

                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* =====================================================
                  ERROR
              ===================================================== */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l6.06 10.79c.75 1.334-.213 2.986-1.743 2.986H3.94c-1.53 0-2.493-1.652-1.743-2.986l6.06-10.79zM10 13a1 1 0 100-2 1 1 0 000 2zm-1-3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>

                  <span>{error}</span>
                </div>
              )}

              {/* =====================================================
                  LOGIN BUTTON
              ===================================================== */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0b1e3d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2850] focus:outline-none focus:ring-2 focus:ring-[#0b1e3d]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && (
                  <svg
                    aria-hidden
                    className="h-4 w-4 animate-spin text-white/80"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />

                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                )}

                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {/* =======================================================
                FOOTER NOTE
            ======================================================= */}
            <div className="mt-8 border-t border-slate-200 pt-5">
              <p className="text-center text-xs leading-5 text-slate-400">
                Authorized users only. New accounts are provisioned by
                your system administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}