/** Runs deterministic domain and service tests without the live PokéAPI. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], restoreMocks: true },
});
