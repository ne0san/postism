// ログイン:単位1のサービス(リポジトリ)のインターフェース。スケルトン。
// 実装(Cognito の SDK、DynamoDB)は本実装で作る。ローカルと dev の違いは、実装の側に閉じ込める。
import { Context, type Effect } from "effect";
import type {
  AuthProviderUnavailable,
  CodeExpired,
  CodeMismatch,
  Email,
  EmailAlreadyRegistered,
  EventStoreUnavailable,
  PasswordRejected,
  SignedUp,
  SignUpResult,
  TooManyAttempts,
} from "./domain";

/** Cognito への入り口(BFF から使う)。 */
export class CognitoGateway extends Context.Service<
  CognitoGateway,
  {
    readonly signUp: (input: {
      readonly email: Email;
      readonly password: string;
    }) => Effect.Effect<SignUpResult, EmailAlreadyRegistered | PasswordRejected | TooManyAttempts | AuthProviderUnavailable>;
    readonly confirmSignUp: (input: {
      readonly email: Email;
      readonly code: string;
    }) => Effect.Effect<void, CodeMismatch | CodeExpired | TooManyAttempts | AuthProviderUnavailable>;
    readonly resendConfirmationCode: (input: {
      readonly email: Email;
    }) => Effect.Effect<SignUpResult, TooManyAttempts | AuthProviderUnavailable>;
  }
>()("postism/auth/CognitoGateway") {}

/** イベントの保存先(DynamoDB)。同じ冪等キーの二度目は追加しない。 */
export class EventStore extends Context.Service<
  EventStore,
  {
    readonly appendOnce: (input: {
      readonly event: SignedUp;
      /** 冪等キー。同じキーのイベントがあれば追加しない。 */
      readonly idempotencyKey: string;
    }) => Effect.Effect<"appended" | "already-exists", EventStoreUnavailable>;
  }
>()("postism/auth/EventStore") {}
