import oracledb from "oracledb";

import { NextResponse } from "next/server";

import {
  verifyAccessToken,
} from "@/src/utils/jwt";

import { getOracleConnection } from "@/src/db/oracle";

export const runtime = "nodejs";

export async function GET(
  request: Request
) {
  let oracleConnection;

  try {
    // --------------------------------------------------
    // 1. Get access token from cookie
    // --------------------------------------------------

    const cookieHeader =
      request.headers.get("cookie") ?? "";

    const accessToken =
      cookieHeader
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) =>
          cookie.startsWith(
            "access_token="
          )
        )
        ?.split("=")
        .slice(1)
        .join("=");

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Verify JWT
    // --------------------------------------------------

    const token =
      await verifyAccessToken(
        accessToken
      );

    // --------------------------------------------------
    // 3. Connect to Oracle
    // --------------------------------------------------

    oracleConnection =
      await getOracleConnection();

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
          userId: token.userId,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const user =
      userResult.rows?.[0];

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 5. Check account status
    // --------------------------------------------------

    if (user.STATUS !== "ACTIVE") {
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
    // 6. Check Oracle session
    // --------------------------------------------------

    const sessionResult =
      await oracleConnection.execute<{
        SESSION_ID: number;
      }>(
        `
          SELECT SESSION_ID
          FROM INVC_USER_SESSIONS
          WHERE SESSION_ID = :sessionId
            AND USER_ID = :userId
            AND REVOKED_AT IS NULL
            AND EXPIRES_AT > CURRENT_TIMESTAMP
          FETCH FIRST 1 ROW ONLY
        `,
        {
          sessionId:
            Number(token.sessionId),
          userId:
            token.userId,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const session =
      sessionResult.rows?.[0];

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Session expired",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 7. Update Oracle session last used time
    // --------------------------------------------------

    await oracleConnection.execute(
      `
        UPDATE INVC_USER_SESSIONS
        SET LAST_USED_AT = CURRENT_TIMESTAMP
        WHERE SESSION_ID = :sessionId
          AND USER_ID = :userId
      `,
      {
        sessionId:
          Number(token.sessionId),
        userId:
          token.userId,
      }
    );

    await oracleConnection.commit();

    // --------------------------------------------------
    // 8. Return authenticated user
    // --------------------------------------------------

    return NextResponse.json({
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
  } catch (error) {
    console.error(
      "Auth me API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Not authenticated",
      },
      { status: 401 }
    );
  } finally {
    // --------------------------------------------------
    // 9. Close Oracle connection
    // --------------------------------------------------

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