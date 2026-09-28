import { NextResponse } from "next/server";
import { z } from "zod";
import oracledb from "oracledb";

import {
  getAuthenticatedUser,
} from "@/src/auth/auth";

import {
  getOracleConnection,
} from "@/src/db/oracle";

import {
  hashPassword,
} from "@/src/utils/password";

const updateUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .max(200)
    .optional(),

  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .optional(),

  role: z
    .enum(["USER", "ADMIN"])
    .optional(),

  status: z
    .enum([
      "ACTIVE",
      "INACTIVE",
      "LOCKED",
    ])
    .optional(),

  password: z
    .string()
    .min(8)
    .max(200)
    .optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      userId: string;
    }>;
  }
) {
  let oracleConnection;

  try {
    // --------------------------------------------------
    // 0. Authentication
    // --------------------------------------------------

    const admin =
      await getAuthenticatedUser();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Forbidden",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 1. User ID
    // --------------------------------------------------

    const { userId } =
      await context.params;

    const targetUserId =
      Number(userId);

    if (
      !Number.isInteger(
        targetUserId
      ) ||
      targetUserId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid user ID",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 2. Validate request body
    // --------------------------------------------------

    const body =
      await request.json();

    const parsed =
      updateUserSchema.safeParse(
        body
      );

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid user data",
          errors:
            parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input =
      parsed.data;

    // --------------------------------------------------
    // 3. Oracle connection
    // --------------------------------------------------

    oracleConnection =
      await getOracleConnection();

    // --------------------------------------------------
    // 4. Find existing user
    // --------------------------------------------------

    const existingResult =
      await oracleConnection.execute<{
        USER_ID: number;
        EMAIL: string;
        ROLE:
          | "USER"
          | "ADMIN";
        STATUS:
          | "ACTIVE"
          | "INACTIVE"
          | "LOCKED";
      }>(
        `
          SELECT
            USER_ID,
            EMAIL,
            ROLE,
            STATUS
          FROM INVC_APP_USERS
          WHERE USER_ID = :userId
          FETCH FIRST 1 ROW ONLY
        `,
        {
          userId:
            targetUserId,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const existingUser =
      existingResult.rows?.[0];

    if (!existingUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "User not found",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 5. Protect current admin account
    // --------------------------------------------------

    if (
      targetUserId ===
        admin.userId &&
      input.status &&
      input.status !==
        "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot deactivate or lock your own account.",
        },
        { status: 400 }
      );
    }

    if (
      targetUserId ===
        admin.userId &&
      input.role &&
      input.role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You cannot remove your own administrator role.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. Normalize email
    // --------------------------------------------------

    const email =
      input.email
        ?.trim()
        .toLowerCase();

    // --------------------------------------------------
    // 7. Check duplicate email
    // --------------------------------------------------

    if (
      email &&
      email !==
        existingUser.EMAIL.toLowerCase()
    ) {
      const duplicateResult =
        await oracleConnection.execute<{
          USER_ID: number;
        }>(
          `
            SELECT USER_ID
            FROM INVC_APP_USERS
            WHERE LOWER(EMAIL) =
                  LOWER(:email)
              AND USER_ID <> :userId
            FETCH FIRST 1 ROW ONLY
          `,
          {
            email,
            userId:
              targetUserId,
          },
          {
            outFormat:
              oracledb.OUT_FORMAT_OBJECT,
          }
        );

      if (
        duplicateResult.rows &&
        duplicateResult.rows.length > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Email address is already in use.",
          },
          { status: 409 }
        );
      }
    }

    // --------------------------------------------------
    // 8. Hash password if supplied
    // --------------------------------------------------

    let passwordHash:
      | string
      | null = null;

    if (input.password) {
      passwordHash =
        await hashPassword(
          input.password
        );
    }

    // --------------------------------------------------
    // 9. Build dynamic Oracle UPDATE
    //
    // IMPORTANT:
    // PASSWORD_HASH is CLOB.
    // Do not use COALESCE(:passwordHash, PASSWORD_HASH)
    // because Oracle can raise ORA-00932.
    // --------------------------------------------------

    const setClauses: string[] = [];

    const bindParameters: Record<
      string,
      string | number
    > = {
      userId:
        targetUserId,
    };

    if (
      input.fullName !==
      undefined
    ) {
      setClauses.push(
        "FULL_NAME = :fullName"
      );

      bindParameters.fullName =
        input.fullName;
    }

    if (email !== undefined) {
      setClauses.push(
        "EMAIL = :email"
      );

      bindParameters.email =
        email;
    }

    if (input.role !== undefined) {
      setClauses.push(
        "ROLE = :role"
      );

      bindParameters.role =
        input.role;
    }

    if (
      input.status !==
      undefined
    ) {
      setClauses.push(
        "STATUS = :status"
      );

      bindParameters.status =
        input.status;
    }

    if (passwordHash !== null) {
      setClauses.push(
        "PASSWORD_HASH = :passwordHash"
      );

      bindParameters.passwordHash =
        passwordHash;
    }

    // --------------------------------------------------
    // 10. Nothing to update
    // --------------------------------------------------

    if (
      setClauses.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No changes were provided",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 11. Always update UPDATED_AT
    // --------------------------------------------------

    setClauses.push(
      "UPDATED_AT = CURRENT_TIMESTAMP"
    );

    // --------------------------------------------------
    // 12. Update Oracle user
    // --------------------------------------------------

    await oracleConnection.execute(
      `
        UPDATE INVC_APP_USERS
        SET
          ${setClauses.join(",\n          ")}
        WHERE USER_ID = :userId
      `,
      bindParameters
    );

    // --------------------------------------------------
    // 13. Revoke sessions when security-sensitive
    // changes happen
    // --------------------------------------------------

    if (
      passwordHash !== null ||
      input.status !==
        undefined ||
      input.role !==
        undefined
    ) {
      await oracleConnection.execute(
        `
          UPDATE INVC_USER_SESSIONS
          SET
            REVOKED_AT =
              CURRENT_TIMESTAMP
          WHERE USER_ID =
                :userId
            AND REVOKED_AT IS NULL
        `,
        {
          userId:
            targetUserId,
        }
      );
    }

    // --------------------------------------------------
    // 14. Commit
    // --------------------------------------------------

    await oracleConnection.commit();

    // --------------------------------------------------
    // 15. Fetch updated user
    // --------------------------------------------------

    const result =
      await oracleConnection.execute<{
        USER_ID: number;
        EMAIL: string;
        FULL_NAME:
          | string
          | null;
        ROLE:
          | "USER"
          | "ADMIN";
        STATUS:
          | "ACTIVE"
          | "INACTIVE"
          | "LOCKED";
        LAST_LOGIN_AT:
          | Date
          | null;
        CREATED_AT: Date;
        UPDATED_AT: Date;
      }>(
        `
          SELECT
            USER_ID,
            EMAIL,
            FULL_NAME,
            ROLE,
            STATUS,
            LAST_LOGIN_AT,
            CREATED_AT,
            UPDATED_AT
          FROM INVC_APP_USERS
          WHERE USER_ID = :userId
          FETCH FIRST 1 ROW ONLY
        `,
        {
          userId:
            targetUserId,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const updatedUser =
      result.rows?.[0];

    if (!updatedUser) {
      throw new Error(
        "ORACLE_UPDATED_USER_NOT_FOUND"
      );
    }

    // --------------------------------------------------
    // 16. Response
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "User updated successfully.",

      user: {
        user_id:
          Number(
            updatedUser.USER_ID
          ),

        email:
          updatedUser.EMAIL,

        full_name:
          updatedUser.FULL_NAME ??
          null,

        role:
          updatedUser.ROLE,

        status:
          updatedUser.STATUS,

        last_login_at:
          updatedUser.LAST_LOGIN_AT ??
          null,

        created_at:
          updatedUser.CREATED_AT,

        updated_at:
          updatedUser.UPDATED_AT,
      },
    });
  } catch (error) {
    console.error(
      "Admin update user error:",
      error
    );

    if (oracleConnection) {
      try {
        await oracleConnection.rollback();
      } catch (rollbackError) {
        console.error(
          "Oracle update user rollback failed:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to update user",
      },
      { status: 500 }
    );
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