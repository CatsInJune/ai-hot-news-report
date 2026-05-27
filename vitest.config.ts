import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["**/*.test.ts", "src/generated/**"],
    },
    // 顺序执行，避免 prisma mock / 全局 sseManager 串扰
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
