import crypto from "crypto";
import fs from "fs";
import path from "path";

function getPrivateKey(): string {
  const keyPath = process.env.LOGIN_PRIVATE_KEY_PATH;

  if (!keyPath) {
    throw new Error(
      "LOGIN_PRIVATE_KEY_PATH is not configured"
    );
  }

  return fs.readFileSync(
    path.resolve(process.cwd(), keyPath),
    "utf8"
  );
}

export function decryptLoginPassword(
  encryptedPassword: string
): string {
  const privateKey = getPrivateKey();

  return crypto
    .privateDecrypt(
      {
        key: privateKey,
        padding:
          crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(
        encryptedPassword,
        "base64"
      )
    )
    .toString("utf8");
}