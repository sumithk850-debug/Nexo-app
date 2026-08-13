import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  // The service-role secret already has to exist on the server to store and use
  // GitHub connections. Deriving a key from it keeps PATs unreadable in the DB
  // and avoids exposing a second secret to the browser.
  const material =
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!material) {
    throw new Error("Secure GitHub token storage is not configured.");
  }

  return createHash("sha256").update(material).digest();
}

export function encryptGithubToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptGithubToken(storedToken: string): string {
  // OAuth connections saved before encrypted PAT support remain functional.
  if (!storedToken.startsWith(PREFIX)) return storedToken;

  const [ivEncoded, tagEncoded, ciphertextEncoded] = storedToken.slice(PREFIX.length).split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Stored GitHub secret is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
