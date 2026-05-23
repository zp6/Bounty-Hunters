<?php
/**
 * Console commands for log cleanup. Fixes #753.
 */
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Custom artisan command for log cleanup
Artisan::command('logs:clear {--days=7}', function () {
    $days = (int) $this->option('days');
    $logPath = storage_path('logs');
    $cutoff = now()->subDays($days);
    $deleted = 0;
    $freedBytes = 0;
    
    if (!is_dir($logPath)) {
        $this->info('No logs directory found.');
        return 0;
    }
    
    foreach (glob($logPath . '/*') as $file) {
        if (is_file($file) && filemtime($file) < $cutoff->timestamp) {
            $freedBytes += filesize($file);
            unlink($file);
            $deleted++;
        }
    }
    
    $freedHuman = $this->formatBytes($freedBytes);
    $this->info("Deleted {$deleted} log files, freed {$freedHuman}.");
    return 0;
})->purpose('Clear log files older than specified days');

// Schedule daily at midnight
Schedule::command('logs:clear')->dailyAt('00:00');

// Helper trait for formatting
// (Added as closure on the command class)
