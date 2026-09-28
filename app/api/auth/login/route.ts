import crypto from "crypto";
import oracledb from "oracledb";

import { NextResponse } from "next/server";

import {
  findUserByEmail,
  updateLastLogin,
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

export async function POST(request: Request) {
  let oracleConnection;

  try {
    // --------------------------------------------------
    // 1. Read request body
    // --------------------------------------------------

    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const encryptedPassword =
      typeof body.encryptedPassword === "string"
        ? body.encryptedPassword
        : "";

    if (!email || !encryptedPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. Decrypt password
    // --------------------------------------------------

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
          message: "Invalid login credentials",
        },
        { status: 401 }
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid login credentials",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 3. Get client IP
    // --------------------------------------------------

    const forwardedFor =
      request.headers.get(
        "x-forwarded-for"
      );

    const ipAddress =
      forwardedFor
        ?.split(",")[0]
        ?.trim() ??
      request.headers.get(
        "x-real-ip"
      ) ??
      "unknown";

    // --------------------------------------------------
    // 4. Login rate limit
    // --------------------------------------------------

    const rateLimit =
      checkLoginRateLimit(
        email,
        ipAddress
      );

    if (rateLimit.blocked) {
      return NextResponse.json(
        {
          success: false,
          error: "LOGIN_RATE_LIMITED",
          message:
            "Too many login attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After":
              String(
                rateLimit.retryAfterSeconds
              ),
          },
        }
      );
    }

    // --------------------------------------------------
    // 5. Find user from Oracle
    // --------------------------------------------------

    const user =
      await findUserByEmail(email);

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

    // --------------------------------------------------
    // 6. Check account status
    // --------------------------------------------------

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Account is not active",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 7. Verify password using bcrypt
    // --------------------------------------------------

    const passwordValid =
      await verifyPassword(
        password,
        user.passwordHash
      );

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

    // --------------------------------------------------
    // 8. Successful login
    // --------------------------------------------------

    clearLoginFailures(
      email,
      ipAddress
    );

    // --------------------------------------------------
    // 9. Create opaque session token
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 10. Create Oracle session
    // --------------------------------------------------

    oracleConnection =
      await getOracleConnection();

    // Enable detailed Oracle constraint errors
    // for this database session.
    await oracleConnection.execute(
      `ALTER SESSION SET ERROR_MESSAGE_DETAILS = ON`
    );

    await oracleConnection.execute(
      `
        INSERT INTO INVC_USER_SESSIONS (
          USER_ID,
          SESSION_TOKEN_HASH,
          EXPIRES_AT,
          USER_AGENT,
          IP_ADDRESS
        )
        VALUES (
          :userId,
          :sessionTokenHash,
          :expiresAt,
          :userAgent,
          :ipAddress
        )
      `,
      {
        userId: user.userId,
        sessionTokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      }
    );

    await oracleConnection.commit();

    // --------------------------------------------------
    // 11. Get Oracle session ID
    // --------------------------------------------------

    const sessionResult =
      await oracleConnection.execute<{
        SESSION_ID: number;
      }>(
        `
          SELECT SESSION_ID
          FROM INVC_USER_SESSIONS
          WHERE SESSION_TOKEN_HASH =
                :sessionTokenHash
            AND USER_ID = :userId
            AND REVOKED_AT IS NULL
          FETCH FIRST 1 ROW ONLY
        `,
        {
          sessionTokenHash,
          userId: user.userId,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const sessionRow =
      sessionResult.rows?.[0];

    if (!sessionRow) {
      throw new Error(
        "ORACLE_SESSION_ID_NOT_CREATED"
      );
    }

    const sessionId =
      Number(
        sessionRow.SESSION_ID
      );

    await oracleConnection.close();

    oracleConnection =
      undefined;

    // --------------------------------------------------
    // 12. Create short-lived access token
    // --------------------------------------------------

    const accessToken =
      await createAccessToken({
        userId: user.userId,
        role: user.role,
        sessionId:
          String(sessionId),
      });

    // --------------------------------------------------
    // 13. Update last login
    // --------------------------------------------------

    await updateLastLogin(
      user.userId
    );

    // --------------------------------------------------
    // 14. Response
    // --------------------------------------------------

    const response =
      NextResponse.json({
        success: true,
        user: {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });

    // --------------------------------------------------
    // 15. Access token cookie
    // --------------------------------------------------

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

        maxAge: 15 * 60,
      }
    );

    // --------------------------------------------------
    // 16. Refresh token cookie
    // --------------------------------------------------

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
    // Never log request body or password.
    console.error(
      "Login API error:",
      error
    );

    // --------------------------------------------------
    // Rollback Oracle transaction
    // --------------------------------------------------

    if (oracleConnection) {
      try {
        await oracleConnection.rollback();
      } catch {
        console.error(
          "Oracle login rollback failed"
        );
      }

      try {
        await oracleConnection.close();
      } catch {
        console.error(
          "Oracle connection close failed"
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "INTERNAL_SERVER_ERROR",
        message: "Unable to login",
      },
      { status: 500 }
    );
  }
}