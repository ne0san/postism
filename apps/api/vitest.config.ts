import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.vitest.ts"],
    // 今は devenv で Node を無効にしているので、vitest を Bun で動かす(bun --bun)。
    // Bun では既定の forks プールが起動しない(child.channel.unref が無い)ため threads にする。
    // Node で動かすかどうかは未決(PR の「Node での動作の担保」を参照)。
    pool: "threads",
  },
});
