// Web:BFF(apps/api)を通る。スケルトン(呼び出しの順番だけ。中身は TODO)。
// 接続先はプロファイルから(EXPO_PUBLIC_API_BASE_URL)。
import type { SignUpClient } from "./signUpClient.types";

export const signUpClient: SignUpClient = {
  async signUp({ email, password }) {
    // 1. 入力の形を確かめる(画面での早めの知らせ。最終的な検証は BFF)。
    // 2. POST /auth/signup を呼ぶ。
    // 3. エラーの応答を SignUpError に変える。
    // 4. 確認コードの送り先を返す。
    throw new Error("TODO: signUp(Web)");
  },
  async confirmSignUp({ email, code }) {
    // 1. POST /auth/signup/confirm を呼ぶ。
    // 2. エラーの応答を SignUpError に変える。
    throw new Error("TODO: confirmSignUp(Web)");
  },
  async resendConfirmationCode({ email }) {
    // 1. POST /auth/signup/resend を呼ぶ。
    // 2. 送り先を返す。
    throw new Error("TODO: resendConfirmationCode(Web)");
  },
};
