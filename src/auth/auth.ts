import { cookies } from "next/headers";

import {
  verifyAccessToken,
} from "@/src/utils/jwt";

import { getOracleConnection } from "@/src/db/oracle";

export interface AuthUser {
  userId: number;
  email: string;
  fullName: string | null;
  role: "USER" | "ADMIN";
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  let oracleConnection;

  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get("access_token")?.value;

    if (!accessToken) {
      return null;
    }

    const token =
      await verifyAccessToken(accessToken);

    oracleConnection =
      await getOracleConnection();

    // Oracle user
    const oracleUserResult =
      await oracleConnection.execute<{
        USER_ID: number;
        EMAIL: string;
        FULL_NAME: string | null;
        ROLE: "USER" | "ADMIN";
        STATUS: "ACTIVE" | "INACTIVE" | "LOCKED";
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
          outFormat: 4002,
        }
      );

    const oracleUser =
      oracleUserResult.rows?.[0];

    if (
      !oracleUser ||
      oracleUser.STATUS !== "ACTIVE"
    ) {
      return null;
    }

    // Oracle session
    const oracleSessionResult =
      await oracleConnection.execute(
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
          sessionId: token.sessionId,
          userId: token.userId,
        },
        {
          outFormat: 4002,
        }
      );

    if (
      !oracleSessionResult.rows ||
      oracleSessionResult.rows.length === 0
    ) {
      return null;
    }

    // Update session activity in Oracle
    await oracleConnection.execute(
      `
        UPDATE INVC_USER_SESSIONS
        SET LAST_USED_AT = CURRENT_TIMESTAMP
        WHERE SESSION_ID = :sessionId
      `,
      {
        sessionId: token.sessionId,
      }
    );

    await oracleConnection.commit();

    return {
      userId: Number(oracleUser.USER_ID),
      email: oracleUser.EMAIL,
      fullName: oracleUser.FULL_NAME,
      role: oracleUser.ROLE,
    };
  } catch (error) {
    console.error(
      "Authentication error:",
      error
    );

    return null;
  } finally {
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

export async function requireAuth(): Promise<AuthUser> {
  const user =
    await getAuthenticatedUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user =
    await requireAuth();

  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  return user;
}