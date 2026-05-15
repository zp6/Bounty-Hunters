<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Webhook extends Model
{
    use HasFactory;

    protected $fillable = [
        'url',
        'secret',
        'events',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'events' => 'array',
            'active' => 'boolean',
        ];
    }

    /**
     * Get the deliveries for this webhook.
     */
    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class);
    }

    /**
     * Check if this webhook handles a given event.
     */
    public function handlesEvent(string $event): bool
    {
        if (!$this->active) {
            return false;
        }

        $events = $this->events ?? [];

        // Empty events list means all events
        if (empty($events)) {
            return true;
        }

        return in_array($event, $events) || in_array('*', $events);
    }
}
