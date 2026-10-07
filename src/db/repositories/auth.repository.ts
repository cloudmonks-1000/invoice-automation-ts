import oracledb from "oracledb";

import { getOracleConnection } from "@/src/db/oracle";

export interface AppUser {
  userId: number;
  email: string;
  passwordHash: string;
  fullName: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
}

type OracleConnection = Awaited<
  ReturnType<typeof getOracleConnection>
>;

export async function findUserByEmail(
  email: string
): Promise<AppUser | null> {
  const normalizedEmail = email.trim();

  let oracleConnection;

  try {
    oracleConnection =
      await getOracleConnection();

    const result =
      await oracleConnection.execute<{
        USER_ID: number;
        EMAIL: string;
        PASSWORD_HASH: string;
        FULL_NAME: string | null;
        ROLE: "USER" | "ADMIN";
        STATUS: "ACTIVE" | "INACTIVE" | "LOCKED";
      }>(
        `
          SELECT
            USER_ID,
            EMAIL,
            PASSWORD_HASH,
            FULL_NAME,
            ROLE,
            STATUS
          FROM INVC_APP_USERS
          WHERE EMAIL = :email
          FETCH FIRST 1 ROW ONLY
        `,
        {
          email: normalizedEmail,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,

          fetchInfo: {
            PASSWORD_HASH: {
              type: oracledb.STRING,
            },
          },
        }
      );

    const row = result.rows?.[0];

    if (!row) {
      return null;
    }

    return {
      userId: Number(row.USER_ID),
      email: row.EMAIL,
      passwordHash: row.PASSWORD_HASH,
      fullName: row.FULL_NAME,
      role: row.ROLE,
      status: row.STATUS,
    };
  } catch (error) {
    console.error(
      "Oracle findUserByEmail failed:",
      error
    );

    throw error;
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

/**
 * Creates the login session and updates
 * LAST_LOGIN_AT using the same Oracle
 * connection and transaction.
 *
 * This combines:
 *
 *   INSERT session
 *   +
 *   UPDATE LAST_LOGIN
 *
 * into a single database round-trip.
 *
 * The caller is responsible for COMMIT.
 */
export async function createSessionAndUpdateLastLogin(
  oracleConnection: OracleConnection,
  params: {
    userId: number;
    sessionTokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string;
  }
): Promise<number> {
  const result =
    await oracleConnection.execute(
      `
        DECLARE
          v_session_id
            INVC_USER_SESSIONS.SESSION_ID%TYPE;
        BEGIN

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
          RETURNING SESSION_ID
          INTO v_session_id;

          UPDATE INVC_APP_USERS
          SET
            LAST_LOGIN_AT =
              CURRENT_TIMESTAMP,
            UPDATED_AT =
              CURRENT_TIMESTAMP
          WHERE USER_ID = :userId;

          :sessionId := v_session_id;

        END;
      `,
      {
        userId:
          params.userId,

        sessionTokenHash:
          params.sessionTokenHash,

        expiresAt:
          params.expiresAt,

        userAgent:
          params.userAgent,

        ipAddress:
          params.ipAddress,

        sessionId: {
          dir: oracledb.BIND_OUT,
          type: oracledb.NUMBER,
        },
      }
    );

  const sessionIdValue = (
    result.outBinds as
      | {
          sessionId?: number;
        }
      | undefined
  )?.sessionId;

  if (
    sessionIdValue ===
      undefined ||
    sessionIdValue === null
  ) {
    throw new Error(
      "ORACLE_SESSION_ID_NOT_CREATED"
    );
  }

  return Number(sessionIdValue);
}

/**
 * Update LAST_LOGIN_AT using an existing
 * Oracle connection.
 *
 * Kept because other application code
 * may already use this function.
 */
export async function updateLastLoginWithConnection(
  oracleConnection: OracleConnection,
  userId: number
): Promise<void> {
  await oracleConnection.execute(
    `
      UPDATE INVC_APP_USERS
      SET
        LAST_LOGIN_AT =
          CURRENT_TIMESTAMP,
        UPDATED_AT =
          CURRENT_TIMESTAMP
      WHERE USER_ID = :userId
    `,
    {
      userId,
    }
  );
}

/**
 * Existing standalone function.
 *
 * Kept for compatibility with any other
 * application code using updateLastLogin().
 */
export async function updateLastLogin(
  userId: number
): Promise<void> {
  let oracleConnection;

  try {
    oracleConnection =
      await getOracleConnection();

    await updateLastLoginWithConnection(
      oracleConnection,
      userId
    );

    await oracleConnection.commit();
  } catch (error) {
    console.error(
      "Oracle updateLastLogin failed:",
      error
    );

    throw error;
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