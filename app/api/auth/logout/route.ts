import { NextResponse } from "next/server";

import { cookies } from "next/headers";

import crypto from "crypto";

import { getOracleConnection } from "@/src/db/oracle";

export const runtime = "nodejs";

export async function POST() {
  let oracleConnection;

  try {
    // --------------------------------------------------
    // 1. Read cookies
    // --------------------------------------------------

    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get("access_token")?.value;

    const refreshToken =
      cookieStore.get("refresh_token")?.value;

    // --------------------------------------------------
    // 2. Revoke Oracle session
    // --------------------------------------------------

    if (refreshToken) {
      const sessionTokenHash =
        crypto
          .createHash("sha256")
          .update(refreshToken)
          .digest("hex");

      oracleConnection =
        await getOracleConnection();

      await oracleConnection.execute(
        `
          UPDATE INVC_USER_SESSIONS
          SET REVOKED_AT = CURRENT_TIMESTAMP
          WHERE SESSION_TOKEN_HASH = :sessionTokenHash
            AND REVOKED_AT IS NULL
        `,
        {
          sessionTokenHash,
        }
      );

      await oracleConnection.commit();
    }

    // --------------------------------------------------
    // 3. Create response
    // --------------------------------------------------

    const response =
      NextResponse.json({
        success: true,
        message: "Logged out successfully",
      });

    // --------------------------------------------------
    // 4. Clear access token cookie
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 5. Clear refresh token cookie
    // --------------------------------------------------

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

    return response;
  } catch (error) {
    console.error(
      "Logout API error:",
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
          "Oracle logout rollback failed:",
          rollbackError
        );
      }
    }

    // Even if DB logout fails, clear browser cookies.
    const response =
      NextResponse.json(
        {
          success: false,
          error: "INTERNAL_SERVER_ERROR",
          message: "Unable to logout",
        },
        { status: 500 }
      );

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

    return response;
  } finally {
    if (oracleConnection) {
      try {
        await oracleConnection.close();
      } catch (closeError) {
        console.error(
          "Oracle logout connection close failed:",
          closeError
        );
      }
    }
  }
}