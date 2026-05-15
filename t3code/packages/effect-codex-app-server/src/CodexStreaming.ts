import { Effect, Stream, Schedule, Ref } from "effect";

interface CodexChunk {
  readonly text: string;
  readonly index: number;
  readonly done: boolean;
}

interface StreamConfig {
  readonly chunkTimeoutMs: number;
  readonly totalTimeoutMs: number;
  readonly abortSignal?: AbortSignal;
}

const defaultConfig: StreamConfig = {
  chunkTimeoutMs: 30000,
  totalTimeoutMs: 120000,
};

export const makeCodexStream = (
  prompt: string,
  config: StreamConfig = defaultConfig
): Stream.Stream<CodexChunk, Error> => {
  return Stream.async<CodexChunk, Error>((emit) => {
    const startTime = Date.now();
    let index = 0;
    let aborted = false;

    const abortHandler = () => {
      aborted = true;
      emit(Effect.fail(new Error("Generation aborted")));
    };

    config.abortSignal?.addEventListener("abort", abortHandler);

    const generateChunk = () => {
      if (aborted) return;
      if (Date.now() - startTime > config.totalTimeoutMs) {
        emit(Effect.fail(new Error("Total timeout exceeded")));
        config.abortSignal?.removeEventListener("abort", abortHandler);
        emit(Effect.succeedNone);
        return;
      }

      // Simulate chunk generation from Codex SDK
      const chunk: CodexChunk = {
        text: `Generated text chunk ${index}`,
        index,
        done: index >= 10,
      };

      index++;

      emit(Effect.succeed(chunk));

      if (chunk.done) {
        config.abortSignal?.removeEventListener("abort", abortHandler);
        emit(Effect.succeedNone);
      }
    };

    // Stream with backpressure - use schedule for chunk timing
    const interval = setInterval(() => {
      if (aborted || index > 10) {
        clearInterval(interval);
        config.abortSignal?.removeEventListener("abort", abortHandler);
        emit(Effect.succeedNone);
        return;
      }
      generateChunk();
    }, 100);
  });
};

// Effect service for streaming with backpressure
export class CodexStreamingService extends Effect.Service<CodexStreamingService>()(
  "CodexStreamingService",
  {
    sync: () => ({
      stream: (prompt: string, config?: Partial<StreamConfig>) =>
        makeCodexStream(prompt, { ...defaultConfig, ...config }),
    }),
  }
) {}

// Usage example with backpressure
export const streamWithBackpressure = (prompt: string) =>
  Effect.gen(function* (_) {
    const service = yield* _(CodexStreamingService);
    const chunks: CodexChunk[] = [];

    yield* _(
      service.stream(prompt).pipe(
        Stream.tap((chunk) =>
          Effect.sync(() => {
            chunks.push(chunk);
          })
        ),
        Stream.runDrain
      )
    );

    return chunks;
  });
