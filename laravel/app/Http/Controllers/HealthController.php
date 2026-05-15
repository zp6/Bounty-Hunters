<?php
/**
 * Health check controller with retry logic.
 * Fixes #785 - Add database health check endpoint.
 */
namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    /**
     * Check database connectivity with retry logic.
     * Attempts 3 connections with 500ms delay before reporting failure.
     */
    public function database(): JsonResponse
    {
        $maxRetries = 3;
        $delayMs = 500;
        $lastError = null;
        $latencyMs = 0;
        
        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                $start = microtime(true);
                DB::connection()->getPdo();
                $latencyMs = round((microtime(true) - $start) * 1000, 2);
                
                return response()->json([
                    'status' => 'healthy',
                    'driver' => DB::connection()->getDriverName(),
                    'latency_ms' => $latencyMs,
                    'connection_name' => DB::connection()->getName(),
                ]);
            } catch (\Exception $e) {
                $lastError = $e->getMessage();
                if ($attempt < $maxRetries) {
                    usleep($delayMs * 1000);
                }
            }
        }
        
        return response()->json([
            'status' => 'unhealthy',
            'error' => $lastError,
            'driver' => config('database.default'),
            'connection_name' => config('database.default'),
        ], 503);
    }
}
