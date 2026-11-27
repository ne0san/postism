// iOS:端末から Cognito に直接つなぐ(パブリッククライアント)。スケルトン(呼び出しの順番だけ。中身は TODO)。
// 接続先はプロファイルから(EXPO_PUBLIC_COGNITO_ENDPOINT は local だけ、EXPO_PUBLIC_IOS_CLIENT_ID、EXPO_PUBLIC_AWS_REGION)。
import type { SignUpClient } from "./signUpClient.types";

export const signUpClient: SignUpClient = {
  async signUp({ email, password }) {
    // 1. メールを小文字にそろえ、形とパスワードの長さを確かめる(サーバーの規則と同じ。だめなら SignUpFailed)。
    // 2. Cognito の SignUp を呼ぶ(ClientId は iOS 用。属性に email)。
    // 3. Cognito のエラーを SignUpError に変える(UsernameExistsException → email-already-registered など)。
    // 4. 確認コードの送り先を返す。
    throw new Error("TODO: signUp(iOS)");
  },
  async confirmSignUp({ email, code }) {
    // 1. メールを小文字にそろえ、コードの形を確かめる。
    // 2. Cognito の ConfirmSignUp を呼ぶ(成功すると、サーバーの PostConfirmation のトリガーが動く)。
    // 3. Cognito のエラーを SignUpError に変える(CodeMismatchException、ExpiredCodeException など)。
    throw new Error("TODO: confirmSignUp(iOS)");
  },
  async resendConfirmationCode({ email }) {
    // 1. メールを小文字にそろえる。
    // 2. Cognito の ResendConfirmationCode を呼ぶ(ローカルの cognito-local は非対応。dev で確かめる)。
    // 3. 送り先を返す。
    throw new Error("TODO: resendConfirmationCode(iOS)");
  },
};
