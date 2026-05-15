import { Effect, Ref, Schedule, Stream, HashMap } from "effect";

interface RpcMetric {
  method: string;
  durationMs: number;
  error: boolean;
  timestamp: number;
}

interface AggregatedWindow {
  windowStart: number;
  windowEnd: number;
  methods: HashMap.HashMap<string, MethodMetrics>;
}

interface MethodMetrics {
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number;
  count: number;
}

const WINDOW_SIZE_MS = 60_000; // 1 minute
const MAX_WINDOWS = 60; // 1 hour of data

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
};

const aggregateMethod = (metrics: RpcMetric[]): MethodMetrics => {
  const durations = metrics.map((m) => m.durationMs).sort((a, b) => a - b);
  const errors = metrics.filter((m) => m.error).length;

  return {
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    errorRate: metrics.length > 0 ? (errors / metrics.length) * 100 : 0,
    throughput: metrics.length,
    count: metrics.length,
  };
};

export class MetricsAggregatorService extends Effect.Service<MetricsAggregatorService>()(
  "MetricsAggregatorService",
  {
    effect: Effect.gen(function* (_) {
      const currentMetrics = yield* _(Ref.make<RpcMetric[]>([]));
      const windows = yield* _(Ref.make<AggregatedWindow[]>([]));

      const record = (metric: RpcMetric) =>
        Ref.update(currentMetrics, (metrics) => [...metrics, metric]);

      const aggregateWindow = Effect.gen(function* (_) {
        const metrics = yield* _(Ref.getAndSet(currentMetrics, []));
        if (metrics.length === 0) return;

        const now = Date.now();
        const windowStart = now - WINDOW_SIZE_MS;
        const methodGroups = new Map<string, RpcMetric[]>();

        for (const m of metrics) {
          const arr = methodGroups.get(m.method) || [];
          arr.push(m);
          methodGroups.set(m.method, arr);
        }

        let methods = HashMap.empty<string, MethodMetrics>();
        for (const [method, methodMetrics] of methodGroups) {
          methods = HashMap.set(methods, method, aggregateMethod(methodMetrics));
        }

        const window: AggregatedWindow = {
          windowStart,
          windowEnd: now,
          methods,
        };

        yield* _(
          Ref.update(windows, (w) => [...w, window].slice(-MAX_WINDOWS))
        );
      });

      // Schedule aggregation every minute
      yield* _(
        Effect.gen(function* (_) {
          while (true) {
            yield* _(Effect.sleep("60 seconds"));
            yield* _(aggregateWindow);
          }
        }),
        Effect.fork
      );

      const getAggregatedMetrics = Effect.gen(function* (_) {
        const w = yield* _(Ref.get(windows));
        return w.map((win) => ({
          windowStart: win.windowStart,
          windowEnd: win.windowEnd,
          methods: Object.fromEntries(
            HashMap.toEntries(win.methods).map(([k, v]) => [k, v])
          ),
        }));
      });

      return { record, getAggregatedMetrics };
    }),
  }
) {}

export default MetricsAggregatorService;
