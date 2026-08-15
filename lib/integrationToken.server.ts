import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  // The service-role secret already exists on the server to store per-user
  // connections. Deriving a key from it keeps integration tokens unreadable in
  // the database and avoids exposing a second secret to the browser.
  const material =
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!material) {
    throw new Error("Secure integration token storage is not configured.");
  }

  return createHash("sha256").update(material).digest();
}

export function encryptIntegrationToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptIntegrationToken(storedToken: string): string {
  // Tokens saved before encryption support remain functional.
  if (!storedToken.startsWith(PREFIX)) return storedToken;

  const [ivEncoded, tagEncoded, ciphertextEncoded] = storedToken.slice(PREFIX.length).split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Stored integration secret is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
