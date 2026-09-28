import crypto from "crypto";

import oracledb from "oracledb";

import { NextResponse } from "next/server";

import { getOracleConnection } from "@/src/db/oracle";

import { createAccessToken } from "@/src/utils/jwt";

export const runtime = "nodejs";

const ACCESS_TOKEN_SECONDS = 15 * 60;
const SESSION_DAYS = 30;

function hashSessionToken(
  token: string
): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createSessionToken(): string {
  return crypto
    .randomBytes(64)
    .toString("hex");
}

function clearAuthCookies(
  response: NextResponse
) {
  response.cookies.set(
    "access_token",
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }
  );

  response.cookies.set(
    "refresh_token",
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }
  );
}

export async function POST(
  request: Request
) {
  let oracleConnection;

  try {
    // --------------------------------------------------
    // 1. Read refresh token
    // --------------------------------------------------

    const cookieHeader =
      request.headers.get("cookie") ?? "";

    const refreshToken =
      cookieHeader
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) =>
          cookie.startsWith(
            "refresh_token="
          )
        )
        ?.split("=")
        .slice(1)
        .join("=");

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Refresh token is required",
        },
        { status: 401 }
      );
    }

    const oldTokenHash =
      hashSessionToken(
        refreshToken
      );

    // --------------------------------------------------
    // 2. Connect to Oracle
    // --------------------------------------------------

    oracleConnection =
      await getOracleConnection();

    // --------------------------------------------------
    // 3. Find active Oracle session
    // --------------------------------------------------

    const sessionResult =
      await oracleConnection.execute<{
        SESSION_ID: number;
        USER_ID: number;
        SESSION_TOKEN_HASH: string;
        USER_AGENT: string | null;
        IP_ADDRESS: string | null;
        EXPIRES_AT: Date;
        REVOKED_AT: Date | null;
      }>(
        `
          SELECT
            SESSION_ID,
            USER_ID,
            SESSION_TOKEN_HASH,
            USER_AGENT,
            IP_ADDRESS,
            EXPIRES_AT,
            REVOKED_AT
          FROM INVC_USER_SESSIONS
          WHERE SESSION_TOKEN_HASH = :sessionTokenHash
            AND REVOKED_AT IS NULL
            AND EXPIRES_AT > CURRENT_TIMESTAMP
          FETCH FIRST 1 ROW ONLY
        `,
        {
          sessionTokenHash:
            oldTokenHash,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const session =
      sessionResult.rows?.[0];

    /*
     * Do not reveal whether the token existed,
     * was expired, or was revoked.
     */
    if (!session) {
      const response =
        NextResponse.json(
          {
            success: false,
            message:
              "Invalid refresh token",
          },
          { status: 401 }
        );

      clearAuthCookies(
        response
      );

      return response;
    }

    // --------------------------------------------------
    // 4. Get user from Oracle
    // --------------------------------------------------

    const userResult =
      await oracleConnection.execute<{
        USER_ID: number;
        EMAIL: string;
        FULL_NAME: string | null;
        ROLE: "USER" | "ADMIN";
        STATUS:
          | "ACTIVE"
          | "INACTIVE"
          | "LOCKED";
      }>(
        `
          SELECT
            USER_ID,
            EMAIL,
            FULL_NAME,
            ROLE,
            STATUS
          FROM INVC_APP_USERS
          WHERE USER_ID = :userId
          FETCH FIRST 1 ROW ONLY
        `,
        {
          userId:
            Number(session.USER_ID),
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const user =
      userResult.rows?.[0];

    if (!user) {
      const response =
        NextResponse.json(
          {
            success: false,
            message:
              "Invalid refresh token",
          },
          { status: 401 }
        );

      clearAuthCookies(
        response
      );

      return response;
    }

    // --------------------------------------------------
    // 5. User must still be active
    // --------------------------------------------------

    if (
      user.STATUS !==
      "ACTIVE"
    ) {
      await oracleConnection.execute(
        `
          UPDATE INVC_USER_SESSIONS
          SET REVOKED_AT =
            CURRENT_TIMESTAMP
          WHERE SESSION_ID = :sessionId
            AND REVOKED_AT IS NULL
        `,
        {
          sessionId:
            Number(session.SESSION_ID),
        }
      );

      await oracleConnection.commit();

      const response =
        NextResponse.json(
          {
            success: false,
            message:
              "Account is not active",
          },
          { status: 403 }
        );

      clearAuthCookies(
        response
      );

      return response;
    }

    // --------------------------------------------------
    // 6. Create new refresh token
    // --------------------------------------------------

    const newRefreshToken =
      createSessionToken();

    const newRefreshTokenHash =
      hashSessionToken(
        newRefreshToken
      );

    const newExpiresAt =
      new Date(
        Date.now() +
          SESSION_DAYS *
            24 *
            60 *
            60 *
            1000
      );

    // --------------------------------------------------
    // 7. Revoke old Oracle session
    // --------------------------------------------------

    await oracleConnection.execute(
      `
        UPDATE INVC_USER_SESSIONS
        SET
          REVOKED_AT =
            CURRENT_TIMESTAMP
        WHERE SESSION_ID = :sessionId
          AND USER_ID = :userId
          AND REVOKED_AT IS NULL
      `,
      {
        sessionId:
          Number(session.SESSION_ID),
        userId:
          Number(session.USER_ID),
      }
    );

    // --------------------------------------------------
    // 8. Create new Oracle session
    // --------------------------------------------------

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
        userId:
          Number(session.USER_ID),

        sessionTokenHash:
          newRefreshTokenHash,

        expiresAt:
          newExpiresAt,

        userAgent:
          session.USER_AGENT,

        ipAddress:
          session.IP_ADDRESS,
      }
    );

    await oracleConnection.commit();

    // --------------------------------------------------
    // 9. Get new Oracle session ID
    // --------------------------------------------------

    const newSessionResult =
      await oracleConnection.execute<{
        SESSION_ID: number;
      }>(
        `
          SELECT SESSION_ID
          FROM INVC_USER_SESSIONS
          WHERE SESSION_TOKEN_HASH = :sessionTokenHash
            AND USER_ID = :userId
            AND REVOKED_AT IS NULL
          FETCH FIRST 1 ROW ONLY
        `,
        {
          sessionTokenHash:
            newRefreshTokenHash,

          userId:
            Number(session.USER_ID),
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const newSession =
      newSessionResult.rows?.[0];

    if (!newSession) {
      throw new Error(
        "ORACLE_NEW_SESSION_NOT_FOUND"
      );
    }

    const newSessionId =
      Number(
        newSession.SESSION_ID
      );

    // --------------------------------------------------
    // 10. Update last used time
    // --------------------------------------------------

    await oracleConnection.execute(
      `
        UPDATE INVC_USER_SESSIONS
        SET LAST_USED_AT =
          CURRENT_TIMESTAMP
        WHERE SESSION_ID = :sessionId
          AND USER_ID = :userId
      `,
      {
        sessionId:
          newSessionId,

        userId:
          Number(session.USER_ID),
      }
    );

    await oracleConnection.commit();

    // --------------------------------------------------
    // 11. Close Oracle connection
    // --------------------------------------------------

    await oracleConnection.close();
    oracleConnection = undefined;

    // --------------------------------------------------
    // 12. Create new access token
    // --------------------------------------------------

    const accessToken =
      await createAccessToken({
        userId:
          Number(user.USER_ID),

        role:
          user.ROLE,

        sessionId:
          String(newSessionId),
      });

    // --------------------------------------------------
    // 13. Create response
    // --------------------------------------------------

    const response =
      NextResponse.json({
        success: true,

        user: {
          userId:
            Number(user.USER_ID),

          email:
            user.EMAIL,

          fullName:
            user.FULL_NAME,

          role:
            user.ROLE,
        },
      });

    // --------------------------------------------------
    // 14. Set new access token
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

        maxAge:
          ACCESS_TOKEN_SECONDS,
      }
    );

    // --------------------------------------------------
    // 15. Set rotated refresh token
    // --------------------------------------------------

    response.cookies.set(
      "refresh_token",
      newRefreshToken,
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
    console.error(
      "Refresh token API error:",
      error
    );

    // --------------------------------------------------
    // Rollback Oracle transaction
    // --------------------------------------------------

    if (oracleConnection) {
      try {
        await oracleConnection.rollback();
      } catch (rollbackError) {
        console.error(
          "Oracle refresh rollback failed:",
          rollbackError
        );
      }

      try {
        await oracleConnection.close();
      } catch (closeError) {
        console.error(
          "Failed to close Oracle connection:",
          closeError
        );
      }
    }

    const response =
      NextResponse.json(
        {
          success: false,
          message:
            "Unable to refresh session",
        },
        { status: 500 }
      );

    clearAuthCookies(
      response
    );

    return response;
  } finally {
    if (oracleConnection) {
      try {
        await oracleConnection.close();
      } catch (closeError) {
        console.error(
          "Failed to close Oracle connection:",
          closeError
        );
      }
    }
  }
}