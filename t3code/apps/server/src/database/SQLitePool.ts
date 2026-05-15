import { Effect, Pool, Config } from "effect";
import { SqliteClient } from "@effect/sql-sqlite-bun";

interface DatabaseConnection {
  readonly query: <A>(sql: string, params?: unknown[]) => Effect.Effect<A[], Error>;
  readonly execute: (sql: string, params?: unknown[]) => Effect.Effect<void, Error>;
  readonly close: () => Effect.Effect<void, Error>;
}

const createConnection = (dbPath: string): Effect.Effect<DatabaseConnection, Error> =>
  Effect.gen(function* (_) {
    // Enable WAL mode and performance pragmas on each connection
    const client = yield* _(
      SqliteClient.make({
        filename: dbPath,
      })
    );

    // Configure SQLite for WAL mode
    yield* _(client.execute("PRAGMA journal_mode=WAL"));
    yield* _(client.execute("PRAGMA busy_timeout=5000"));
    yield* _(client.execute("PRAGMA synchronous=NORMAL"));
    yield* _(client.execute("PRAGMA foreign_keys=ON"));
    yield* _(client.execute("PRAGMA temp_store=MEMORY"));

    return {
      query: <A>(sql: string, params?: unknown[]) =>
        Effect.tryPromise({
          try: () => client.execute(sql, params) as Promise<A[]>,
          catch: (e) => new Error(String(e)),
        }),
      execute: (sql: string, params?: unknown[]) =>
        Effect.tryPromise({
          try: () => client.execute(sql, params) as Promise<void>,
          catch: (e) => new Error(String(e)),
        }),
      close: () => Effect.succeed(undefined),
    };
  });

// Connection pool with Effect.Pool
export const DatabasePool = Effect.gen(function* (_) {
  const dbPath = yield* _(
    Config.string("DATABASE_URL").pipe(
      Config.withDefault("./data/t3code.db")
    )
  );

  const pool = yield* _(
    Pool.make({
      acquire: createConnection(dbPath),
      min: 1,
      max: 5,
      timeToLive: Duration.minutes(30),
    })
  );

  return pool;
});

// Health check
export const healthCheck = (pool: Pool.Pool<DatabaseConnection, Error>) =>
  Effect.gen(function* (_) {
    const conn = yield* _(pool.get);
    const result = yield* _(conn.query<{ integrity_check: string }[]>("PRAGMA integrity_check"));
    return {
      healthy: result[0]?.integrity_check === "ok",
      journalMode: "WAL",
      poolSize: 5,
    };
  });

export type { DatabaseConnection };
