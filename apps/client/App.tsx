// 動作確認用の最小画面。画面や機能は作り込まない。
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text testID="hello">postism ({Platform.OS})</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
