import crypto from "crypto";
import fs from "fs";
import path from "path";

let privateKey: string | undefined;

function getPrivateKey(): string {
  if (privateKey) {
    return privateKey;
  }

  const keyPath =
    process.env.LOGIN_PRIVATE_KEY_PATH;

  if (!keyPath) {
    throw new Error(
      "LOGIN_PRIVATE_KEY_PATH is not configured"
    );
  }

  privateKey = fs.readFileSync(
    path.resolve(
      process.cwd(),
      keyPath
    ),
    "utf8"
  );

  return privateKey;
}

export function decryptLoginPassword(
  encryptedPassword: string
): string {
  return crypto
    .privateDecrypt(
      {
        key: getPrivateKey(),
        padding:
          crypto.constants
            .RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(
        encryptedPassword,
        "base64"
      )
    )
    .toString("utf8");
}