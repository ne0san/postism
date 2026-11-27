// ログイン:単位1(サインアップとメールの確認コード)の、クライアント側の公開する関数の型。スケルトン。
// iOS は端末から Cognito に直接つなぐ(signUpClient.ios.ts)。Web は BFF を通る(signUpClient.web.ts)。
// どちらも同じ型にそろえ、画面はプラットフォームを意識しない。

export type SignUpResult = {
  /** 確認コードの送り先(伏せ字)。 */
  readonly codeDeliveryDestination?: string;
};

/** 画面に出し分けるエラー。 */
export type SignUpError =
  | { readonly kind: "invalid-email" }
  | { readonly kind: "password-too-short"; readonly minLength: number }
  | { readonly kind: "password-rejected" }
  | { readonly kind: "email-already-registered" }
  | { readonly kind: "code-mismatch" }
  | { readonly kind: "code-expired" }
  | { readonly kind: "too-many-attempts" }
  | { readonly kind: "unavailable" };

export type SignUpClient = {
  readonly signUp: (input: { email: string; password: string }) => Promise<SignUpResult>;
  readonly confirmSignUp: (input: { email: string; code: string }) => Promise<void>;
  readonly resendConfirmationCode: (input: { email: string }) => Promise<SignUpResult>;
};

/** 失敗したときに投げる。`error` で画面の出し分けをする。 */
export class SignUpFailed extends Error {
  constructor(readonly error: SignUpError) {
    super(error.kind);
  }
}
