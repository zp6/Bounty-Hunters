<?php
/**
 * Failed job monitoring listener and summary command. Fixes #789.
 */
namespace App\Listeners;

use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class FailedJobMonitor
{
    public function handle(JobFailed $event): void
    {
        $jobName = get_class($event->job);
        $error = $event->exception->getMessage();
        
        Log::channel('error')->error("Job failed: {$jobName}", [
            'job' => $jobName,
            'error' => $error,
            'queue' => $event->job->getQueue(),
            'attempts' => $event->job->attempts(),
            'connection' => $event->connectionName,
        ]);
    }
}
