// プラットフォームごとの実装の入り口。Expo(Metro)は、iOS では signUpClient.ios.ts、Web では
// signUpClient.web.ts を先に選ぶ。このファイルは、型チェック(tsc)と、それ以外のプラットフォーム用。
// Android は対象外(将来、足すときに signUpClient.android.ts を作る)。
export { signUpClient } from "./signUpClient.ios";
export * from "./signUpClient.types";
