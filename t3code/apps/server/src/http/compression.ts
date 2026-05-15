import { Effect, Layer } from "effect";
import { HttpServerResponse, HttpServerRequest } from "@effect/platform";
import { zlib } from "zlib";

const COMPRESSIBLE_TYPES = new Set([
  "application/json",
  "text/html",
  "text/plain",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/xml",
  "text/xml",
  "application/graphql-response+json",
]);

const ALREADY_COMPRESSED = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/gzip",
  "application/x-gzip",
  "application/zip",
  "application/x-brotli",
]);

const MIN_SIZE = 1024; // 1KB

const compressBuffer = (
  buffer: Buffer,
  encoding: "gzip" | "br"
): Effect.Effect<Buffer, Error> =>
  Effect.tryPromise({
    try: () =>
      new Promise((resolve, reject) => {
        const cb = (err: Error | null, result: Buffer) =>
          err ? reject(err) : resolve(result);
        if (encoding === "br") {
          zlib.brotliCompress(buffer, cb);
        } else {
          zlib.gzip(buffer, cb);
        }
      }),
    catch: (e) => new Error(String(e)),
  });

const decompressBuffer = (
  buffer: Buffer,
  encoding: string
): Effect.Effect<Buffer, Error> =>
  Effect.tryPromise({
    try: () =>
      new Promise((resolve, reject) => {
        const cb = (err: Error | null, result: Buffer) =>
          err ? reject(err) : resolve(result);
        switch (encoding) {
          case "gzip":
            zlib.gunzip(buffer, cb);
            break;
          case "br":
            zlib.brotliDecompress(buffer, cb);
            break;
          case "deflate":
            zlib.inflate(buffer, cb);
            break;
          default:
            resolve(buffer);
        }
      }),
    catch: (e) => new Error(String(e)),
  });

export const compressionMiddleware = {
  compress: (response: HttpServerResponse, request: HttpServerRequest) =>
    Effect.gen(function* (_) {
      const body = response.body;
      if (typeof body === "string") {
        const buffer = Buffer.from(body);
        if (buffer.length < MIN_SIZE) return response;

        // Check content type
        const contentType = response.headers["content-type"] as string;
        if (!contentType || ALREADY_COMPRESSED.has(contentType.split(";")[0])) {
          return response;
        }
        if (!COMPRESSIBLE_TYPES.has(contentType.split(";")[0].trim())) {
          return response;
        }

        // Parse Accept-Encoding
        const acceptEncoding = request.headers["accept-encoding"] || "";
        const useBrotli = acceptEncoding.includes("br");
        const useGzip = acceptEncoding.includes("gzip");

        if (!useBrotli && !useGzip) return response;

        const encoding = useBrotli ? "br" : "gzip";
        const compressed = yield* _(compressBuffer(buffer, encoding));

        return HttpServerResponse.stream(compressed as any).pipe(
          (r: any) =>
            r.setHeaders({
              ...response.headers,
              "content-encoding": encoding,
              "content-length": String(compressed.length),
              vary: "Accept-Encoding",
            })
        );
      }
      return response;
    }),

  decompressRequest: (request: HttpServerRequest) =>
    Effect.gen(function* (_) {
      const encoding = request.headers["content-encoding"];
      if (!encoding || encoding === "identity") return request;

      const body = request.body;
      if (typeof body === "string") {
        const decompressed = yield* _(
          decompressBuffer(Buffer.from(body), encoding)
        );
        return { ...request, body: decompressed.toString() } as any;
      }
      return request;
    }),
};

export type { };
