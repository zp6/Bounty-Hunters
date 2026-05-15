<?php
/**
 * Health check routes. Part of issue #785.
 */
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HealthController;

Route::get('/health/database', [HealthController::class, 'database']);
