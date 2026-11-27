// ログイン:単位1の公開する関数(Lambda のハンドラー)。スケルトン(呼び出しの順番だけ。中身は TODO)。
// Web は BFF(この API)を通る。iOS は端末から Cognito に直接つなぐので、ここは通らない
// (PostConfirmation のトリガーだけは、iOS でサインアップした人にも動く)。
// SAM の template.yaml への登録(関数、HttpApi のルート、トリガー)は、本実装で行う。
import { Effect, Layer, Schema } from "effect";
import {
  ConfirmSignUpRequest,
  InvalidRequest,
  ResendConfirmationCodeRequest,
  SignUpRequest,
  type UserId,
} from "./domain";
import { CognitoGateway, EventStore } from "./services";
import { confirmSignUp, recordSignedUp, resendConfirmationCode, signUp } from "./usecases";

/** API Gateway(HTTP API、payload v2)の入出力のうち、使う部分。 */
type HttpEvent = { readonly body?: string; readonly isBase64Encoded?: boolean };
type HttpResult = { readonly statusCode: number; readonly headers?: Record<string, string>; readonly body: string };

/** Cognito の PostConfirmation のトリガーの入出力のうち、使う部分。入力をそのまま返す。 */
type PostConfirmationEvent = {
  readonly triggerSource: string;
  readonly request: { readonly userAttributes: Record<string, string> };
};

/** サービスの実装をまとめたもの(本実装で、Cognito と DynamoDB の実装に差し替える)。 */
const AuthLive = Layer.mergeAll(
  Layer.effect(CognitoGateway, Effect.die("TODO: CognitoGateway の実装(local は cognito-local、dev は Cognito)")),
  Layer.effect(EventStore, Effect.die("TODO: EventStore の実装(DynamoDB)")),
);

/** POST /auth/signup */
export const signUpHandler = (event: HttpEvent): Promise<HttpResult> =>
  Effect.gen(function* () {
    // 1. 本文を JSON として読み、SignUpRequest として検証する(だめなら InvalidRequest)。
    const body: unknown = yield* Effect.die("TODO: 本文を JSON として読む");
    const request = yield* Schema.decodeUnknownEffect(SignUpRequest)(body).pipe(
      Effect.mapError((e) => new InvalidRequest({ reason: String(e) })),
    );
    // 2. ユースケースを呼ぶ。
    const result = yield* signUp(request);
    // 3. 応答にする(201、確認コードの送り先)。
    return yield* Effect.die("TODO: 成功の応答にする");
  }).pipe(
    // 4. エラーを HTTP の応答にする(400、409、429、503 など。メールが登録済みかを推測されにくい応答にする)。
    Effect.catch(() => Effect.die("TODO: エラーを HTTP の応答にする")),
    Effect.provide(AuthLive),
    Effect.runPromise,
  );

/** POST /auth/signup/confirm */
export const confirmSignUpHandler = (event: HttpEvent): Promise<HttpResult> =>
  Effect.gen(function* () {
    // 1. 本文を読み、ConfirmSignUpRequest として検証する。
    const body: unknown = yield* Effect.die("TODO: 本文を JSON として読む");
    const request = yield* Schema.decodeUnknownEffect(ConfirmSignUpRequest)(body).pipe(
      Effect.mapError((e) => new InvalidRequest({ reason: String(e) })),
    );
    // 2. ユースケースを呼ぶ。
    yield* confirmSignUp(request);
    // 3. 応答にする(204)。
    return yield* Effect.die("TODO: 成功の応答にする");
  }).pipe(
    // 4. エラーを HTTP の応答にする(400、410、429、503 など)。
    Effect.catch(() => Effect.die("TODO: エラーを HTTP の応答にする")),
    Effect.provide(AuthLive),
    Effect.runPromise,
  );

/** POST /auth/signup/resend */
export const resendConfirmationCodeHandler = (event: HttpEvent): Promise<HttpResult> =>
  Effect.gen(function* () {
    // 1. 本文を読み、ResendConfirmationCodeRequest として検証する。
    const body: unknown = yield* Effect.die("TODO: 本文を JSON として読む");
    const request = yield* Schema.decodeUnknownEffect(ResendConfirmationCodeRequest)(body).pipe(
      Effect.mapError((e) => new InvalidRequest({ reason: String(e) })),
    );
    // 2. ユースケースを呼ぶ。
    const result = yield* resendConfirmationCode(request);
    // 3. 応答にする(202、送り先)。
    return yield* Effect.die("TODO: 成功の応答にする");
  }).pipe(
    // 4. エラーを HTTP の応答にする。
    Effect.catch(() => Effect.die("TODO: エラーを HTTP の応答にする")),
    Effect.provide(AuthLive),
    Effect.runPromise,
  );

/**
 * Cognito の PostConfirmation のトリガー。メールの確認が済んだときに呼ばれ、SignedUp イベントを残す。
 * 失敗すると Cognito の確認自体が失敗するので、保存の失敗は記録して、確認は通す(本実装で決める)。
 */
export const onPostConfirmation = (event: PostConfirmationEvent): Promise<PostConfirmationEvent> =>
  Effect.gen(function* () {
    // 1. サインアップの確認のときだけ動く(パスワードの再設定の確認では何もしない)。
    if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") return event;
    // 2. sub を取り出す。
    const userId: UserId = yield* Effect.die("TODO: userAttributes から sub を取り出す");
    // 3. イベントを残す。
    yield* recordSignedUp({ userId, confirmedAt: new Date() });
    // 4. 入力をそのまま返す(Cognito のトリガーの決まり)。
    return event;
  }).pipe(
    Effect.catch(() => Effect.die("TODO: 保存の失敗を記録し、確認は通す")),
    Effect.provide(AuthLive),
    Effect.runPromise,
  );
