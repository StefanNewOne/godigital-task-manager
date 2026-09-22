import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  splitting: false,
  // Bundle-ирај ги само @gd/* workspace пакетите (чист TS). @prisma/client останува external.
  noExternal: [/^@gd\/(core|ui)$/],
});
