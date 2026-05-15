import { Schema } from "@effect/schema";
import { Effect, Console, pipe } from "effect";

// Environment variable schema definitions
export const ServerConfigSchema = Schema.Struct({
  PORT: Schema.Number.pipe(
    Schema.optionalWith({ default: () => 3000 }),
    Schema.description("Server port (default: 3000)")
  ),
  DATABASE_URL: Schema.String.pipe(
    Schema.minLength(1),
    Schema.description("SQLite database file path")
  ),
  JWT_SECRET: Schema.String.pipe(
    Schema.minLength(32),
    Schema.description("JWT signing secret (min 32 chars)")
  ),
  NODE_ENV: Schema.Literal("development", "production", "test").pipe(
    Schema.optionalWith({ default: () => "development" as const }),
    Schema.description("Node environment")
  ),
  LOG_LEVEL: Schema.Literal("debug", "info", "warn", "error").pipe(
    Schema.optionalWith({ default: () => "info" as const }),
    Schema.description("Logging level")
  ),
  GIT_EXECUTABLE_PATH: Schema.String.pipe(
    Schema.optionalWith({ default: () => "git" }),
    Schema.description("Path to git executable")
  ),
  MAX_FILE_SIZE_MB: Schema.Number.pipe(
    Schema.optionalWith({ default: () => 50 }),
    Schema.positive(),
    Schema.description("Max file upload size in MB")
  ),
});

interface ValidationIssue {
  key: string;
  error: string;
  expected: string;
  received: string;
}

export const validateConfig = (env: Record<string, string | undefined>) =>
  Effect.gen(function* (_) {
    const issues: ValidationIssue[] = [];

    // Required vars
    const required: Array<{
      key: string;
      validate: (v: string) => boolean;
      expected: string;
    }> = [
      {
        key: "DATABASE_URL",
        validate: (v) => v.length > 0,
        expected: "Non-empty string (file path)",
      },
      {
        key: "JWT_SECRET",
        validate: (v) => v.length >= 32,
        expected: "String with at least 32 characters",
      },
    ];

    for (const { key, validate, expected } of required) {
      const value = env[key];
      if (!value) {
        issues.push({
          key,
          error: "MISSING",
          expected,
          received: "(not set)",
        });
      } else if (!validate(value)) {
        issues.push({
          key,
          error: "INVALID",
          expected,
          received: `"${value.substring(0, 20)}..."`,
        });
      }
    }

    // Optional with defaults
    const optional: Array<{
      key: string;
      validate: (v: string) => boolean;
      expected: string;
      defaultVal: string;
    }> = [
      {
        key: "PORT",
        validate: (v) => !isNaN(Number(v)) && Number(v) > 0,
        expected: "Positive number",
        defaultVal: "3000",
      },
      {
        key: "NODE_ENV",
        validate: (v) => ["development", "production", "test"].includes(v),
        expected: "development | production | test",
        defaultVal: "development",
      },
    ];

    for (const { key, validate, expected, defaultVal } of optional) {
      const value = env[key];
      if (value && !validate(value)) {
        issues.push({
          key,
          error: "INVALID",
          expected,
          received: `"${value}"`,
        });
      }
    }

    if (issues.length > 0) {
      // Format error table
      const table = formatErrorTable(issues);
      yield* _(
        Console.error(
          "\n❌ Environment variable validation failed:\n\n" + table + "\n"
        )
      );
      return yield* _(Effect.fail(new Error("Config validation failed")));
    }

    // Build and return validated config
    return {
      PORT: Number(env.PORT) || 3000,
      DATABASE_URL: env.DATABASE_URL!,
      JWT_SECRET: env.JWT_SECRET!,
      NODE_ENV: (env.NODE_ENV as "development" | "production" | "test") || "development",
      LOG_LEVEL: (env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",
      GIT_EXECUTABLE_PATH: env.GIT_EXECUTABLE_PATH || "git",
      MAX_FILE_SIZE_MB: Number(env.MAX_FILE_SIZE_MB) || 50,
    };
  });

function formatErrorTable(issues: ValidationIssue[]): string {
  const maxKey = Math.max(...issues.map((i) => i.key.length), 10);
  const maxExpected = Math.max(...issues.map((i) => i.expected.length), 15);

  const header = `${"Variable".padEnd(maxKey)} | ${"Status".padEnd(8)} | ${"Expected".padEnd(maxExpected)} | Received`;
  const separator = "-".repeat(header.length);

  const rows = issues.map(
    (i) =>
      `${i.key.padEnd(maxKey)} | ${i.error.padEnd(8)} | ${i.expected.padEnd(maxExpected)} | ${i.received}`
  );

  return [header, separator, ...rows].join("\n");
}

// CLI validation mode
export const runValidateConfig = () =>
  Effect.gen(function* (_) {
    yield* _(Console.log("🔍 Validating configuration..."));
    const result = yield* _(
      validateConfig(process.env as Record<string, string | undefined>),
      Effect.either
    );

    if (result._tag === "Right") {
      yield* _(Console.log("✅ All configuration is valid"));
      yield* _(
        Console.log(
          JSON.stringify(result.right, null, 2)
            .split("\n")
            .map((l) => "  " + l)
            .join("\n")
        )
      );
    } else {
      process.exit(1);
    }
  });
