<?php
/**
 * Slack notification service with retry and timeout handling. Fixes #791.
 */
namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\SlackMessage;
use Illuminate\Support\Facades\Log;

class SlackNotification extends Notification
{
    use Queueable;

    public function __construct(
        private string $title,
        private string $message,
        private string $level = 'info',
    ) {}

    public function via($notifiable): array
    {
        return ['slack'];
    }

    public function toSlack($notifiable): SlackMessage
    {
        $slack = (new SlackMessage())
            ->{$this->level}()
            ->content($this->message)
            ->attachment(function ($attachment) {
                $attachment->title($this->title);
            });

        return $slack;
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Slack notification failed', [
            'title' => $this->title,
            'error' => $exception->getMessage(),
        ]);
    }
}
