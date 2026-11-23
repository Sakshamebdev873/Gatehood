import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every file shares one emulator and several clear it, so run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
