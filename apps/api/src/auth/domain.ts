// ログイン:単位1(サインアップとメールの確認コード)の型。スケルトン。
// 入出力、エンティティ(イベント)、エラーだけを置く。処理は usecases.ts。
import { Data, Schema } from "effect";

/** パスワードの最小の長さ(ユーザープールの設定と同じ。cognito-local は効かせないので、アプリでも確かめる)。 */
export const MIN_PASSWORD_LENGTH = 12;

/** 小文字にそろえ、形を確かめたメールアドレス。 */
export type Email = string & { readonly _brand: "Email" };

/** Cognito のユーザーの識別子(`sub`)。アプリのユーザー ID として使う(L5a で決定)。 */
export type UserId = string & { readonly _brand: "UserId" };

// ---- 入出力 ----

export const SignUpRequest = Schema.Struct({
  email: Schema.String,
  password: Schema.String,
});
export type SignUpRequest = typeof SignUpRequest.Type;

export type SignUpResult = {
  /** 確認コードの入力が要るか(ふつうは true)。 */
  readonly confirmationRequired: boolean;
  /** 確認コードの送り先(伏せ字。例:t***@e***)。 */
  readonly codeDeliveryDestination?: string;
};

export const ConfirmSignUpRequest = Schema.Struct({
  email: Schema.String,
  code: Schema.String,
});
export type ConfirmSignUpRequest = typeof ConfirmSignUpRequest.Type;

export const ResendConfirmationCodeRequest = Schema.Struct({
  email: Schema.String,
});
export type ResendConfirmationCodeRequest = typeof ResendConfirmationCodeRequest.Type;

// ---- イベント(0026 の「サインアップされた」) ----

export const SignedUp = Schema.Struct({
  /** イベント ID(ULID)。 */
  eventId: Schema.String,
  type: Schema.Literal("SignedUp"),
  /** 日時(ISO 8601)。メールの確認が済んだ時点。 */
  occurredAt: Schema.String,
  /** 持ち主のユーザー ID(Cognito の sub)。 */
  userId: Schema.String,
  actor: Schema.Literal("user"),
});
export type SignedUp = typeof SignedUp.Type;

// ---- エラー ----

/** 入力の形が正しくない(JSON でない、項目が足りない)。 */
export class InvalidRequest extends Data.TaggedError("InvalidRequest")<{ readonly reason: string }> {}
/** メールアドレスの形が正しくない。 */
export class InvalidEmail extends Data.TaggedError("InvalidEmail")<{}> {}
/** パスワードが短い。 */
export class PasswordTooShort extends Data.TaggedError("PasswordTooShort")<{ readonly minLength: number }> {}
/** Cognito がパスワードを受け付けなかった(規則の違反など)。 */
export class PasswordRejected extends Data.TaggedError("PasswordRejected")<{}> {}
/** メールアドレスが登録済み。 */
export class EmailAlreadyRegistered extends Data.TaggedError("EmailAlreadyRegistered")<{}> {}
/** 確認コードが違う。 */
export class CodeMismatch extends Data.TaggedError("CodeMismatch")<{}> {}
/** 確認コードの期限が切れた。 */
export class CodeExpired extends Data.TaggedError("CodeExpired")<{}> {}
/** 試行が多すぎる(Cognito の制限)。 */
export class TooManyAttempts extends Data.TaggedError("TooManyAttempts")<{}> {}
/** Cognito に届かない、想定外の応答。 */
export class AuthProviderUnavailable extends Data.TaggedError("AuthProviderUnavailable")<{ readonly cause: unknown }> {}
/** イベントの保存先に届かない。 */
export class EventStoreUnavailable extends Data.TaggedError("EventStoreUnavailable")<{ readonly cause: unknown }> {}
