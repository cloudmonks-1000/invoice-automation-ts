import { NextResponse } from "next/server";
import oracledb from "oracledb";

import { getAuthenticatedUser } from "@/src/auth/auth";
import { getOracleConnection } from "@/src/db/oracle";
import { hashPassword } from "@/src/utils/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --------------------------------------------------
// GET - List users
// --------------------------------------------------

export async function GET() {
  let oracleConnection;

  try {
    const admin =
      await getAuthenticatedUser();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Admin access required",
        },
        { status: 403 }
      );
    }

    oracleConnection =
      await getOracleConnection();

    const result =
      await oracleConnection.execute<{
        USER_ID: number;
        EMAIL: string;
        FULL_NAME: string | null;
        ROLE: "USER" | "ADMIN";
        STATUS: "ACTIVE" | "INACTIVE" | "LOCKED";
        LAST_LOGIN_AT: Date | null;
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
          ORDER BY CREATED_AT DESC
        `,
        {},
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const users =
      (result.rows ?? []).map((row) => ({
        user_id: Number(row.USER_ID),
        email: row.EMAIL,
        full_name: row.FULL_NAME ?? null,
        role: row.ROLE,
        status: row.STATUS,
        last_login_at:
          row.LAST_LOGIN_AT ?? null,
        created_at: row.CREATED_AT,
        updated_at: row.UPDATED_AT,
      }));

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(
      "Admin users GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load users",
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

// --------------------------------------------------
// POST - Create user
// --------------------------------------------------

export async function POST(
  request: Request
) {
  let oracleConnection;

  try {
    const admin =
      await getAuthenticatedUser();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          message: "Not authenticated",
        },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Admin access required",
        },
        { status: 403 }
      );
    }

    const body =
      await request.json();

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const role =
      body.role === "ADMIN"
        ? "ADMIN"
        : "USER";

    const status =
      body.status === "INACTIVE"
        ? "INACTIVE"
        : "ACTIVE";

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Email and password are required",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Password must be at least 8 characters",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // Oracle connection
    // --------------------------------------------------

    oracleConnection =
      await getOracleConnection();

    // --------------------------------------------------
    // Check duplicate email
    // --------------------------------------------------

    const existing =
      await oracleConnection.execute<{
        USER_ID: number;
      }>(
        `
          SELECT USER_ID
          FROM INVC_APP_USERS
          WHERE LOWER(EMAIL) = LOWER(:email)
          FETCH FIRST 1 ROW ONLY
        `,
        {
          email,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    if (
      existing.rows &&
      existing.rows.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A user with this email already exists",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // Hash password
    // --------------------------------------------------

    const passwordHash =
      await hashPassword(password);

    // --------------------------------------------------
    // Insert user
    // --------------------------------------------------

    await oracleConnection.execute(
      `
        INSERT INTO INVC_APP_USERS (
          EMAIL,
          PASSWORD_HASH,
          FULL_NAME,
          ROLE,
          STATUS
        )
        VALUES (
          :email,
          :passwordHash,
          :fullName,
          :role,
          :status
        )
      `,
      {
        email,
        passwordHash,
        fullName:
          fullName || null,
        role,
        status,
      }
    );

    await oracleConnection.commit();

    // --------------------------------------------------
    // Fetch newly created user
    // --------------------------------------------------

    const result =
      await oracleConnection.execute<{
        USER_ID: number;
        EMAIL: string;
        FULL_NAME: string | null;
        ROLE: "USER" | "ADMIN";
        STATUS: "ACTIVE" | "INACTIVE" | "LOCKED";
        CREATED_AT: Date;
      }>(
        `
          SELECT
            USER_ID,
            EMAIL,
            FULL_NAME,
            ROLE,
            STATUS,
            CREATED_AT
          FROM INVC_APP_USERS
          WHERE LOWER(EMAIL) = LOWER(:email)
          FETCH FIRST 1 ROW ONLY
        `,
        {
          email,
        },
        {
          outFormat:
            oracledb.OUT_FORMAT_OBJECT,
        }
      );

    const createdUser =
      result.rows?.[0];

    if (!createdUser) {
      throw new Error(
        "ORACLE_CREATED_USER_NOT_FOUND"
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "User created successfully",
        user: {
          user_id:
            Number(
              createdUser.USER_ID
            ),
          email:
            createdUser.EMAIL,
          full_name:
            createdUser.FULL_NAME ??
            null,
          role:
            createdUser.ROLE,
          status:
            createdUser.STATUS,
          created_at:
            createdUser.CREATED_AT,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin users POST error:",
      error
    );

    if (oracleConnection) {
      try {
        await oracleConnection.rollback();
      } catch (rollbackError) {
        console.error(
          "Oracle user creation rollback failed:",
          rollbackError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create user",
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