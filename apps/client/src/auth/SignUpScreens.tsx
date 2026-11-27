// ログイン:単位1の画面。スケルトン(呼び出しの順番だけ。見た目は仮で、中身は TODO)。
// 画面の遷移(サインアップ → 確認コード → サインイン)は、画面の仕組み(expo-router など)を決めるときに入れる。
import { Text, View } from "react-native";
import { signUpClient } from "./signUpClient";

/** サインアップの画面(メールとパスワード)。 */
export function SignUpScreen(props: { onSubmitted: (email: string, destination?: string) => void }) {
  const submit = async (email: string, password: string) => {
    // 1. signUpClient.signUp を呼ぶ。
    // 2. 成功したら、確認コードの画面へ(props.onSubmitted)。
    // 3. SignUpFailed なら、error.kind に応じて出し分ける(パスワードが短い、登録済み、など)。
    void signUpClient;
    void props;
    throw new Error(`TODO: SignUpScreen.submit(${email.length}, ${password.length})`);
  };
  void submit;
  return (
    <View>
      <Text>TODO: サインアップ(メール、パスワード、送信)</Text>
    </View>
  );
}

/** 確認コードの画面(6桁のコード、再送)。 */
export function ConfirmSignUpScreen(props: { email: string; onConfirmed: () => void }) {
  const confirm = async (code: string) => {
    // 1. signUpClient.confirmSignUp を呼ぶ。
    // 2. 成功したら、サインインの画面へ(props.onConfirmed)。初回のサインインで TOTP を登録する(単位2)。
    // 3. SignUpFailed なら、コードが違う、期限切れ、などを出し分ける。
    throw new Error(`TODO: ConfirmSignUpScreen.confirm(${code.length})`);
  };
  const resend = async () => {
    // 1. signUpClient.resendConfirmationCode を呼ぶ。
    // 2. 送り先を知らせる。回数の制限(too-many-attempts)を出し分ける。
    throw new Error("TODO: ConfirmSignUpScreen.resend");
  };
  void confirm;
  void resend;
  return (
    <View>
      <Text>TODO: 確認コード({props.email} に送ったコード、確認、再送)</Text>
    </View>
  );
}
