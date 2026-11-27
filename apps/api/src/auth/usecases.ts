// ログイン:単位1のユースケース。スケルトン(呼び出しの順番だけ。中身は TODO)。
import { Effect } from "effect";
import {
  type ConfirmSignUpRequest,
  type Email,
  type ResendConfirmationCodeRequest,
  type SignedUp,
  type SignUpRequest,
  type SignUpResult,
  type UserId,
} from "./domain";
import { CognitoGateway, EventStore } from "./services";

/** サインアップ。成功すると、Cognito が確認コードをメールで送る。 */
export const signUp = (request: SignUpRequest) =>
  Effect.gen(function* () {
    // 1. メールを小文字にそろえ、形を確かめる(だめなら InvalidEmail)。
    const email: Email = yield* Effect.die("TODO: メールを小文字にそろえ、形を確かめる");
    // 2. パスワードの長さを確かめる(MIN_PASSWORD_LENGTH 未満なら PasswordTooShort)。
    yield* Effect.die("TODO: パスワードの長さを確かめる");
    // 3. Cognito に登録する。
    const cognito = yield* CognitoGateway;
    const result: SignUpResult = yield* cognito.signUp({ email, password: request.password });
    // TODO: 確認が済んでいない同じメールのユーザーが残っている場合の扱い(確認コードを送り直すか)を、本実装で決める。
    return result;
  });

/** メールの確認コードを確かめる。成功すると、Cognito が PostConfirmation のトリガーを呼ぶ。 */
export const confirmSignUp = (request: ConfirmSignUpRequest) =>
  Effect.gen(function* () {
    // 1. メールを小文字にそろえ、形を確かめる。
    const email: Email = yield* Effect.die("TODO: メールを小文字にそろえ、形を確かめる");
    // 2. 確認コードの形を確かめる(6桁の数字)。
    yield* Effect.die("TODO: 確認コードの形を確かめる");
    // 3. Cognito で確かめる。
    const cognito = yield* CognitoGateway;
    yield* cognito.confirmSignUp({ email, code: request.code });
  });

/** 確認コードを送り直す(ローカルの cognito-local は非対応。dev で確かめる)。 */
export const resendConfirmationCode = (request: ResendConfirmationCodeRequest) =>
  Effect.gen(function* () {
    // 1. メールを小文字にそろえ、形を確かめる。
    const email: Email = yield* Effect.die("TODO: メールを小文字にそろえ、形を確かめる");
    // 2. Cognito に送り直してもらう。
    const cognito = yield* CognitoGateway;
    return yield* cognito.resendConfirmationCode({ email });
  });

/**
 * サインアップされたことを、イベントとして残す(PostConfirmation のトリガーから呼ぶ)。
 * トリガーは再実行されうるので、冪等キーを sub から決めて、二度目は追加しない。
 */
export const recordSignedUp = (input: { readonly userId: UserId; readonly confirmedAt: Date }) =>
  Effect.gen(function* () {
    // 1. SignedUp イベントを組み立てる(イベント ID は ULID、occurredAt は confirmedAt、actor は "user")。
    const event: SignedUp = yield* Effect.die("TODO: SignedUp イベントを組み立てる");
    // 2. 冪等キーは `signup#<userId>`。
    const idempotencyKey = `signup#${input.userId}`;
    // 3. 保存する(既にあれば何もしない)。
    const store = yield* EventStore;
    return yield* store.appendOnce({ event, idempotencyKey });
  });
