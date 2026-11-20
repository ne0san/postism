// 疎通確認用の画面(使い捨て)。サインイン → API 呼び出し → 結果の表示だけ。
import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

const COGNITO = process.env.EXPO_PUBLIC_COGNITO_ENDPOINT ?? "http://127.0.0.1:9229";
const CLIENT_ID = process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID ?? "";
const API = "http://127.0.0.1:3001";
// iOS シミュレーターでは画面の操作を自動化しにくいので、確認用に起動時に自動で実行できるようにする。
// EXPO_PUBLIC_SMOKE_AUTORUN=1 のときだけ。パスワードはローカルの固定値(秘密ではない。scripts/local/config.ts)。
const AUTORUN = process.env.EXPO_PUBLIC_SMOKE_AUTORUN === "1";
const LOCAL_TEST_PASSWORD = "LocalPassw0rd!";

async function signIn(username: string, password: string): Promise<string> {
  const res = await fetch(COGNITO, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`sign-in failed: ${JSON.stringify(body)}`);
  return body.AuthenticationResult.AccessToken;
}

export default function App() {
  const [username, setUsername] = useState("test@example.com");
  const [password, setPassword] = useState(AUTORUN ? LOCAL_TEST_PASSWORD : "");
  const [result, setResult] = useState("");

  const run = async () => {
    setResult("running...");
    try {
      const token = await signIn(username, password);
      const res = await fetch(`${API}/smoke`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      setResult(`signed in: ok\napi: ${res.status}\n${JSON.stringify(await res.json(), null, 2)}`);
    } catch (e) {
      setResult(`error: ${(e as Error).message}`);
    }
  };

  useEffect(() => {
    if (AUTORUN) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Text>smoke</Text>
      <TextInput testID="username" style={styles.input} value={username} onChangeText={setUsername} />
      <TextInput testID="password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
      <Button testID="run" title="sign in and call api" onPress={run} />
      <Text testID="result" style={styles.result}>{result}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, maxWidth: 480 },
  input: { borderWidth: 1, borderColor: "#999", padding: 8 },
  result: { fontFamily: "monospace" },
});
