import crypto from "crypto";

import { NextResponse } from "next/server";

import {
  findUserByEmail,
  createSessionAndUpdateLastLogin,
} from "@/src/db/repositories/auth.repository";

import { getOracleConnection } from "@/src/db/oracle";

import { verifyPassword } from "@/src/utils/password";

import { decryptLoginPassword } from "@/src/utils/login-crypto";

import { createAccessToken } from "@/src/utils/jwt";

import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from "@/src/security/login-rate-limit";

export const runtime = "nodejs";

const SESSION_DAYS = 30;

export async function POST(
  request: Request
) {
  let oracleConnection:
    | Awaited<
        ReturnType<typeof getOracleConnection>
      >
    | undefined;

  const requestStart =
    performance.now();

  try {
    /*
     * ---------------------------------------------------------
     * REQUEST BODY
     * ---------------------------------------------------------
     */

    const rawBody =
      await request.text();

    if (!rawBody.trim()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request body is required",
        },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid request body",
        },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid request body",
        },
        { status: 400 }
      );
    }

    const requestBody =
      body as {
        email?: unknown;
        encryptedPassword?: unknown;
      };

    const email =
      typeof requestBody.email ===
      "string"
        ? requestBody.email
            .trim()
            .toLowerCase()
        : "";

    const encryptedPassword =
      typeof requestBody.encryptedPassword ===
      "string"
        ? requestBody.encryptedPassword
        : "";

    if (
      !email ||
      !encryptedPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email and password are required",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * RSA PASSWORD DECRYPT
     * ---------------------------------------------------------
     */

    const decryptStart =
      performance.now();

    let password: string;

    try {
      password =
        decryptLoginPassword(
          encryptedPassword
        );
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid login credentials",
        },
        { status: 401 }
      );
    }

    const decryptMs =
      performance.now() -
      decryptStart;

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid login credentials",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * CLIENT IP
     * ---------------------------------------------------------
     */

    const forwardedFor =
      request.headers.get(
        "x-forwarded-for"
      );

    const ipAddress =
      forwardedFor
        ?.split(",")[0]
        ?.trim() ||
      request.headers.get(
        "x-real-ip"
      ) ||
      "unknown";

    /*
     * ---------------------------------------------------------
     * LOGIN RATE LIMIT
     * ---------------------------------------------------------
     */

    const rateLimit =
      checkLoginRateLimit(
        email,
        ipAddress
      );

    if (rateLimit.blocked) {
      return NextResponse.json(
        {
          success: false,
          error:
            "LOGIN_RATE_LIMITED",
          message:
            "Too many login attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              rateLimit.retryAfterSeconds
            ),
          },
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * USER LOOKUP
     * ---------------------------------------------------------
     */

    const userLookupStart =
      performance.now();

    const user =
      await findUserByEmail(email);

    const userLookupMs =
      performance.now() -
      userLookupStart;

    if (!user) {
      recordLoginFailure(
        email,
        ipAddress
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid email or password",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * ACCOUNT STATUS
     * ---------------------------------------------------------
     */

    if (
      user.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Account is not active",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * BCRYPT PASSWORD VERIFY
     * ---------------------------------------------------------
     */

    const bcryptStart =
      performance.now();

    const passwordValid =
      await verifyPassword(
        password,
        user.passwordHash
      );

    const bcryptMs =
      performance.now() -
      bcryptStart;

    if (!passwordValid) {
      recordLoginFailure(
        email,
        ipAddress
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid email or password",
        },
        { status: 401 }
      );
    }

    /*
     * Successful authentication.
     *
     * Clear the failed-attempt counters
     * only after password verification succeeds.
     */
    clearLoginFailures(
      email,
      ipAddress
    );

    /*
     * ---------------------------------------------------------
     * SESSION TOKEN PREPARATION
     * ---------------------------------------------------------
     */

    const tokenStart =
      performance.now();

    const sessionToken =
      crypto
        .randomBytes(64)
        .toString("hex");

    const sessionTokenHash =
      crypto
        .createHash("sha256")
        .update(sessionToken)
        .digest("hex");

    const expiresAt =
      new Date(
        Date.now() +
          SESSION_DAYS *
            24 *
            60 *
            60 *
            1000
      );

    const userAgent =
      request.headers.get(
        "user-agent"
      );

    const tokenPreparationMs =
      performance.now() -
      tokenStart;

    /*
     * ---------------------------------------------------------
     * ORACLE CONNECTION
     * ---------------------------------------------------------
     */

    const oracleStart =
      performance.now();

    oracleConnection =
      await getOracleConnection();

    const oracleAcquireMs =
      performance.now() -
      oracleStart;

    /*
     * ---------------------------------------------------------
     * SESSION INSERT + LAST LOGIN
     * ---------------------------------------------------------
     *
     * Both operations are executed through
     * one Oracle round-trip and remain inside
     * the same transaction.
     *
     * The repository function performs:
     *
     *   INSERT INVC_USER_SESSIONS
     *   +
     *   UPDATE INVC_APP_USERS
     *
     * The transaction is committed below.
     */

    const sessionStart =
      performance.now();

    const sessionId =
      await createSessionAndUpdateLastLogin(
        oracleConnection,
        {
          userId:
            user.userId,

          sessionTokenHash,

          expiresAt,

          userAgent,

          ipAddress,
        }
      );

    const sessionDbMs =
      performance.now() -
      sessionStart;

    /*
     * ---------------------------------------------------------
     * COMMIT
     * ---------------------------------------------------------
     */

    const commitStart =
      performance.now();

    await oracleConnection.commit();

    const commitMs =
      performance.now() -
      commitStart;

    /*
     * ---------------------------------------------------------
     * CLOSE ORACLE CONNECTION
     * ---------------------------------------------------------
     */

    const closeStart =
      performance.now();

    await oracleConnection.close();

    oracleConnection =
      undefined;

    const closeMs =
      performance.now() -
      closeStart;

    /*
     * ---------------------------------------------------------
     * JWT
     * ---------------------------------------------------------
     */

    const jwtStart =
      performance.now();

    const accessToken =
      await createAccessToken({
        userId:
          user.userId,

        role:
          user.role,

        sessionId:
          String(sessionId),
      });

    const jwtMs =
      performance.now() -
      jwtStart;

    /*
     * ---------------------------------------------------------
     * PERFORMANCE TIMING
     * ---------------------------------------------------------
     *
     * No credentials, passwords or tokens
     * are logged.
     */

    const totalMs =
      performance.now() -
      requestStart;

    console.log(
      "[LOGIN_TIMING]",
      {
        decryptMs:
          Number(
            decryptMs.toFixed(2)
          ),

        userLookupMs:
          Number(
            userLookupMs.toFixed(2)
          ),

        bcryptMs:
          Number(
            bcryptMs.toFixed(2)
          ),

        tokenPreparationMs:
          Number(
            tokenPreparationMs.toFixed(2)
          ),

        oracleAcquireMs:
          Number(
            oracleAcquireMs.toFixed(2)
          ),

        sessionDbMs:
          Number(
            sessionDbMs.toFixed(2)
          ),

        commitMs:
          Number(
            commitMs.toFixed(2)
          ),

        closeMs:
          Number(
            closeMs.toFixed(2)
          ),

        jwtMs:
          Number(
            jwtMs.toFixed(2)
          ),

        totalMs:
          Number(
            totalMs.toFixed(2)
          ),
      }
    );

    /*
     * ---------------------------------------------------------
     * RESPONSE
     * ---------------------------------------------------------
     */

    const response =
      NextResponse.json({
        success: true,

        user: {
          userId:
            user.userId,

          email:
            user.email,

          fullName:
            user.fullName,

          role:
            user.role,
        },
      });

    /*
     * ACCESS TOKEN
     */

    response.cookies.set(
      "access_token",
      accessToken,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite: "lax",

        path: "/",

        maxAge:
          15 * 60,
      }
    );

    /*
     * REFRESH TOKEN
     */

    response.cookies.set(
      "refresh_token",
      sessionToken,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite: "lax",

        path: "/",

        maxAge:
          SESSION_DAYS *
          24 *
          60 *
          60,
      }
    );

    return response;
  } catch (error) {
    /*
     * ---------------------------------------------------------
     * ERROR HANDLING
     * ---------------------------------------------------------
     */

    console.error(
      "Login API error:",
      {
        name:
          error instanceof Error
            ? error.name
            : "UnknownError",

        message:
          error instanceof Error
            ? error.message
            : String(error),

        stack:
          error instanceof Error
            ? error.stack
            : undefined,
      }
    );

    /*
     * Roll back any uncommitted
     * Oracle transaction.
     */

    if (oracleConnection) {
      try {
        await oracleConnection.rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "Oracle login rollback failed:",
          rollbackError instanceof
          Error
            ? rollbackError.message
            : rollbackError
        );
      }

      /*
       * Always release the connection.
       */

      try {
        await oracleConnection.close();
      } catch (
        closeError
      ) {
        console.error(
          "Oracle connection close failed:",
          closeError instanceof
          Error
            ? closeError.message
            : closeError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,

        error:
          "INTERNAL_SERVER_ERROR",

        message:
          "Unable to login",
      },
      { status: 500 }
    );
  }
}