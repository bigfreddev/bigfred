
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Ignore generated files, build output, and archived backups.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Archived admin sidebar implementations.
    "admin-sidebar-backup/**",
    "admin-sidebar-cleanup-backup/**",

    // Individual backup files.
    "**/*.backup.*",
  ]),
]);

export default eslintConfig;
