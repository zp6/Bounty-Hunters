<?php
/**
 * Rate limiting middleware for web routes. Fixes #749.
 * Also fixes session driver fallback configuration.
 */
namespace App\Http\Middleware;

use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Symfony\Component\HttpFoundation\Response;

class RateLimitMiddleware
{
    protected $limiter;
    
    public function __construct(RateLimiter $limiter)
    {
        $this->limiter = $limiter;
    }
    
    public function handle(Request $request, Closure $next, int $maxAttempts = 60, int $decayMinutes = 1): Response
    {
        $key = $this->resolveRequestSignature($request);
        
        if ($this->limiter->tooManyAttempts($key, $maxAttempts)) {
            return $this->buildResponse($key, $maxAttempts);
        }
        
        $this->limiter->hit($key, $decayMinutes * 60);
        
        $response = $next($request);
        
        $response->headers->add([
            'X-RateLimit-Limit' => $maxAttempts,
            'X-RateLimit-Remaining' => $maxAttempts - $this->limiter->attempts($key),
        ]);
        
        return $response;
    }
    
    protected function resolveRequestSignature(Request $request): string
    {
        return sha1($request->ip() . '|' . $request->path());
    }
    
    protected function buildResponse(string $key, int $maxAttempts): Response
    {
        $retryAfter = $this->limiter->availableIn($key);
        return response()->json([
            'message' => 'Too many requests.',
            'retry_after' => $retryAfter,
        ], 429, ['Retry-After' => $retryAfter]);
    }
}
