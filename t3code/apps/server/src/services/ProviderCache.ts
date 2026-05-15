import { Effect, Cache, Hub, Duration, Ref } from "effect";

interface ProviderModel {
  id: string;
  name: string;
  capabilities: string[];
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttl: number;
}

// Cache configuration
const MODEL_LIST_TTL = Duration.minutes(5);
const CAPABILITY_TTL = Duration.minutes(15);

// Cache invalidation events
export class CacheInvalidationEvent {
  readonly _tag = "CacheInvalidationEvent";
  constructor(readonly providerId?: string) {}
}

// Metrics tracking
const makeMetrics = Effect.gen(function* (_) {
  const hits = yield* _(Ref.make(0));
  const misses = yield* _(Ref.make(0));

  const recordHit = Ref.update(hits, (n) => n + 1);
  const recordMiss = Ref.update(misses, (n) => n + 1);

  const getMetrics = Effect.gen(function* (_) {
    const h = yield* _(Ref.get(hits));
    const m = yield* _(Ref.get(misses));
    return {
      hits: h,
      misses: m,
      hitRate: h + m > 0 ? h / (h + m) : 0,
    } as CacheMetrics;
  });

  return { recordHit, recordMiss, getMetrics };
});

// Provider cache service
export class ProviderCacheService extends Effect.Service<ProviderCacheService>()(
  "ProviderCacheService",
  {
    effect: Effect.gen(function* (_) {
      const metrics = yield* _(makeMetrics);
      const hub = yield* _(Hub.make<CacheInvalidationEvent>());

      // Model list cache (5min TTL)
      const modelCache = yield* _(
        Cache.make({
          capacity: 100,
          timeToLive: MODEL_LIST_TTL,
          lookup: (providerId: string) =>
            Effect.gen(function* (_) {
              yield* _(metrics.recordMiss);
              // This would call the actual provider API
              return yield* _(
                Effect.succeed([] as ProviderModel[]),
                Effect.tap(() => metrics.recordHit)
              );
            }),
        })
      );

      // Capability cache (15min TTL)
      const capabilityCache = yield* _(
        Cache.make({
          capacity: 200,
          timeToLive: CAPABILITY_TTL,
          lookup: (key: string) =>
            Effect.gen(function* (_) {
              yield* _(metrics.recordMiss);
              return yield* _(
                Effect.succeed([] as string[]),
                Effect.tap(() => metrics.recordHit)
              );
            }),
        })
      );

      // Subscribe to invalidation events
      yield* _(
        Hub.subscribe(hub, (event) =>
          Effect.gen(function* (_) {
            if (event.providerId) {
              yield* _(Cache.invalidate(modelCache)(event.providerId));
            } else {
              yield* _(Cache.invalidateAll(modelCache));
              yield* _(Cache.invalidateAll(capabilityCache));
            }
          })
        )
      );

      return {
        getModels: (providerId: string) => Cache.get(modelCache)(providerId),
        getCapabilities: (modelId: string) => Cache.get(capabilityCache)(modelId),
        invalidateProvider: (providerId?: string) =>
          Hub.publish(hub, new CacheInvalidationEvent(providerId)),
        getMetrics: metrics.getMetrics,
      };
    }),
  }
) {};

export default ProviderCacheService;
