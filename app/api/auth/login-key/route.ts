import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicKeyPath = path.join(
      process.cwd(),
      "login-public.pem"
    );

    const publicKey = fs.readFileSync(
      publicKeyPath,
      "utf8"
    );

    return new NextResponse(publicKey, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Login public key error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load login key",
      },
      { status: 500 }
    );
  }
}