import { defineConfig } from "vitest/config";

// vitest は devenv の Node 24(Lambda の nodejs24.x と同じ)で動かす。bun test は *.test.ts を拾うので、
// vitest は *.vitest.ts だけを対象にする。
export default defineConfig({
  test: {
    include: ["src/**/*.vitest.ts"],
  },
});
