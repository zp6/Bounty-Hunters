<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhookDelivery extends Model
{
    use HasFactory;

    protected $fillable = [
        'webhook_id',
        'event',
        'payload',
        'response_code',
        'attempts',
        'next_retry_at',
        'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'attempts' => 'integer',
            'response_code' => 'integer',
            'next_retry_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    /**
     * Get the webhook this delivery belongs to.
     */
    public function webhook(): BelongsTo
    {
        return $this->belongsTo(Webhook::class);
    }

    /**
     * Check if the delivery was successful.
     */
    public function isSuccessful(): bool
    {
        return $this->response_code >= 200 && $this->response_code < 300;
    }

    /**
     * Check if the delivery can be retried.
     */
    public function canRetry(int $maxAttempts = 3): bool
    {
        return !$this->isSuccessful()
            && $this->attempts < $maxAttempts
            && ($this->next_retry_at === null || $this->next_retry_at->isPast());
    }
}
