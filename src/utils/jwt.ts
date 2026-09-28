import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error(
    "JWT_SECRET is not configured"
  );
}

const secretKey =
  new TextEncoder().encode(secret);

export interface AuthTokenPayload {
  userId: number;
  role: "USER" | "ADMIN";
  sessionId: string;
}

export async function createAccessToken(
  payload: AuthTokenPayload
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    role: payload.role,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey);
}

export async function verifyAccessToken(
  token: string
): Promise<AuthTokenPayload> {
  const { payload } =
    await jwtVerify(
      token,
      secretKey,
      {
        algorithms: ["HS256"],
      }
    );

  if (
    typeof payload.userId !== "number" ||
    (payload.role !== "USER" &&
      payload.role !== "ADMIN") ||
    typeof payload.sessionId !== "string"
  ) {
    throw new Error(
      "INVALID_TOKEN_PAYLOAD"
    );
  }

  return {
    userId: payload.userId,
    role: payload.role,
    sessionId: payload.sessionId,
  };
}