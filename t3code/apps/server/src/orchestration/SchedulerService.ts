import { Effect, Schedule, Ref, Schema } from "effect";

// Scheduled command schema
export class ScheduledCommand extends Schema.Class<ScheduledCommand>("ScheduledCommand")({
  commandId: Schema.String,
  scheduledAt: Schema.String, // ISO timestamp
  repeatInterval: Schema.optional(Schema.Number), // seconds
  maxRetries: Schema.Number,
  command: Schema.String,
  status: Schema.Literal("pending", "running", "completed", "failed"),
  createdAt: Schema.String,
  lastRunAt: Schema.optional(Schema.String),
  runCount: Schema.Number,
  error: Schema.optional(Schema.String),
}) {}

type ScheduledCommandType = Schema.Schema.Type<typeof ScheduledCommand>;

interface SchedulerStore {
  create: (cmd: Omit<ScheduledCommandType, "status" | "createdAt" | "lastRunAt" | "runCount" | "error">) => Effect.Effect<ScheduledCommandType, Error>;
  update: (id: string, updates: Partial<ScheduledCommandType>) => Effect.Effect<void, Error>;
  getPending: () => Effect.Effect<ScheduledCommandType[], Error>;
  getById: (id: string) => Effect.Effect<ScheduledCommandType | null, Error>;
  list: () => Effect.Effect<ScheduledCommandType[], Error>;
}

// In-memory store (would be SQLite in production)
const createStore = Effect.gen(function* (_) {
  const commands = yield* _(Ref.make<Map<string, ScheduledCommandType>>(new Map()));

  return {
    create: (cmd) =>
      Effect.gen(function* (_) {
        const now = new Date().toISOString();
        const full: ScheduledCommandType = {
          ...cmd,
          status: "pending",
          createdAt: now,
          lastRunAt: undefined,
          runCount: 0,
          error: undefined,
        };
        yield* _(Ref.update(commands, (m) => new Map(m).set(cmd.commandId, full)));
        return full;
      }),

    update: (id, updates) =>
      Ref.update(commands, (m) => {
        const existing = m.get(id);
        if (!existing) return m;
        const next = new Map(m);
        next.set(id, { ...existing, ...updates });
        return next;
      }),

    getPending: () =>
      Effect.gen(function* (_) {
        const m = yield* _(Ref.get(commands));
        return Array.from(m.values()).filter((c) => {
          if (c.status !== "pending") return false;
          return new Date(c.scheduledAt) <= new Date();
        });
      }),

    getById: (id) =>
      Effect.gen(function* (_) {
        const m = yield* _(Ref.get(commands));
        return m.get(id) || null;
      }),

    list: () =>
      Effect.gen(function* (_) {
        const m = yield* _(Ref.get(commands));
        return Array.from(m.values());
      }),
  } satisfies SchedulerStore;
});

export class SchedulerService extends Effect.Service<SchedulerService>()(
  "SchedulerService",
  {
    effect: Effect.gen(function* (_) {
      const store = yield* _(createStore);
      let running = true;

      // Main scheduler loop
      const runScheduler = Effect.gen(function* (_) {
        while (running) {
          const pending = yield* _(store.getPending());

          for (const cmd of pending) {
            yield* _(
              executeCommand(cmd).pipe(
                Effect.tap(() =>
                  store.update(cmd.commandId, {
                    status: "completed",
                    lastRunAt: new Date().toISOString(),
                    runCount: cmd.runCount + 1,
                  })
                ),
                Effect.catchAll((e) =>
                  store.update(cmd.commandId, {
                    status: "failed",
                    error: String(e),
                    lastRunAt: new Date().toISOString(),
                    runCount: cmd.runCount + 1,
                  })
                )
              )
            );

            // Reschedule recurring commands
            if (cmd.repeatInterval) {
              const nextRun = new Date(
                Date.now() + cmd.repeatInterval * 1000
              ).toISOString();
              yield* _(
                store.update(cmd.commandId, {
                  status: "pending",
                  scheduledAt: nextRun,
                })
              );
            }
          }

          yield* _(Effect.sleep("10 seconds"));
        }
      });

      // Fork scheduler
      yield* _(runScheduler.pipe(Effect.fork));

      return {
        schedule: (cmd: Omit<ScheduledCommandType, "status" | "createdAt" | "lastRunAt" | "runCount" | "error">) =>
          store.create(cmd),

        cancel: (id: string) =>
          store.update(id, { status: "completed" }),

        reschedule: (id: string, newTime: string) =>
          store.update(id, { scheduledAt: newTime, status: "pending" }),

        list: () => store.list(),
        getById: (id: string) => store.getById(id),

        stop: () => Effect.sync(() => { running = false; }),
      };
    }),
  }
) {}

const executeCommand = (cmd: ScheduledCommandType) =>
  Effect.gen(function* (_) {
    yield* _(Effect.logInfo(`Executing command: ${cmd.commandId}`));
    // Command execution logic would go here
  });

export default SchedulerService;
