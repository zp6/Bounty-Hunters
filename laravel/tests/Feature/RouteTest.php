<?php
/**
 * Route test suite - verifies all registered routes return non-500 responses.
 * Part of issue #794 - Fix phpunit.xml coverage config.
 */
namespace Tests\Feature;

use Tests\TestCase;

class RouteTest extends TestCase
{
    /**
     * Test that all registered GET routes return non-500 responses.
     */
    public function test_get_routes_return_non_500(): void
    {
        $routes = \Illuminate\Support\Facades\Route::getRoutes();
        $failures = [];
        
        foreach ($routes as $route) {
            $methods = array_filter($route->methods(), fn($m) => $m !== 'HEAD');
            if (!in_array('GET', $methods)) continue;
            
            $uri = $route->uri();
            // Skip routes with required parameters
            if (preg_match('/\{[^}]+\}/', $uri)) continue;
            
            $response = $this->get($uri);
            if ($response->status() >= 500) {
                $failures[] = "GET {$uri} returned {$response->status()}";
            }
        }
        
        $this->assertEmpty($failures, 'Routes returning 500: ' . implode(', ', $failures));
    }
    
    public function test_home_route_exists(): void
    {
        $response = $this->get('/');
        $this->assertNotEquals(404, $response->status());
    }
}
