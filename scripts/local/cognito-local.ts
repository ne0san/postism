// cognito-local(ローカル専用)を扱う補助。本番や dev では使わない。
import { join } from "node:path";
import * as OTPAuth from "otpauth";

const root = process.env.DEVENV_ROOT ?? join(import.meta.dir, "..", "..");

type StoredUser = {
  Username: string;
  Attributes?: { Name: string; Value: string }[];
  ConfirmationCode?: string;
  SoftwareTokenMfaConfiguration?: { Secret: string; Verified: boolean };
};

/** cognito-local のデータのファイル(.cognito/db/<poolId>.json)から、メールでユーザーを探す。 */
export async function findStoredUser(poolId: string, email: string): Promise<StoredUser | undefined> {
  const file = Bun.file(join(root, ".cognito", "db", `${poolId}.json`));
  if (!(await file.exists())) return undefined;
  const db = (await file.json()) as { Users?: Record<string, StoredUser> };
  return Object.values(db.Users ?? {}).find(
    (u) => u.Attributes?.find((a) => a.Name === "email")?.Value?.toLowerCase() === email.toLowerCase(),
  );
}

/** TOTP のコード(6桁、30秒、SHA1。認証アプリと同じ)。 */
export function totpCode(secret: string): string {
  return new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    digits: 6,
    period: 30,
    algorithm: "SHA1",
  }).generate();
}
