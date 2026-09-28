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
          WHERE LOWER(EMAIL) = LOWER(:email)
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

export async function updateLastLogin(
  userId: number
): Promise<void> {
  let oracleConnection;

  try {
    oracleConnection =
      await getOracleConnection();

    await oracleConnection.execute(
      `
        UPDATE INVC_APP_USERS
        SET
          LAST_LOGIN_AT = CURRENT_TIMESTAMP,
          UPDATED_AT = CURRENT_TIMESTAMP
        WHERE USER_ID = :userId
      `,
      {
        userId,
      }
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