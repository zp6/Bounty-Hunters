<?php

namespace App\Services;

use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WebhookDispatcher
{
    /**
     * Maximum number of retry attempts.
     */
    protected int $maxAttempts = 3;

    /**
     * Dispatch an event to all matching webhooks.
     *
     * @return WebhookDelivery[]
     */
    public function dispatch(string $event, array $payload = []): array
    {
        $deliveries = [];

        $webhooks = Webhook::where('active', true)->get();

        foreach ($webhooks as $webhook) {
            if ($webhook->handlesEvent($event)) {
                $deliveries[] = $this->deliver($webhook, $event, $payload);
            }
        }

        return $deliveries;
    }

    /**
     * Deliver a single webhook event.
     */
    public function deliver(Webhook $webhook, string $event, array $payload): WebhookDelivery
    {
        $delivery = WebhookDelivery::create([
            'webhook_id' => $webhook->id,
            'event' => $event,
            'payload' => $payload,
            'attempts' => 0,
        ]);

        return $this->attemptDelivery($delivery);
    }

    /**
     * Attempt to deliver a webhook, with retry support.
     */
    public function attemptDelivery(WebhookDelivery $delivery): WebhookDelivery
    {
        $webhook = $delivery->webhook;
        $body = json_encode([
            'event' => $delivery->event,
            'payload' => $delivery->payload,
            'timestamp' => now()->toIso8601String(),
            'delivery_id' => $delivery->id,
        ]);

        $signature = hash_hmac('sha256', $body, $webhook->secret);

        $delivery->attempts += 1;

        try {
            $response = Http::withHeaders([
                'X-Webhook-Signature' => $signature,
                'X-Webhook-Event' => $delivery->event,
                'X-Webhook-Delivery' => $delivery->id,
                'Content-Type' => 'application/json',
            ])
                ->timeout(30)
                ->post($webhook->url, [
                    'event' => $delivery->event,
                    'payload' => $delivery->payload,
                    'timestamp' => now()->toIso8601String(),
                    'delivery_id' => $delivery->id,
                ]);

            $delivery->response_code = $response->status();

            if ($response->successful()) {
                $delivery->delivered_at = now();
                $delivery->next_retry_at = null;
            } else {
                $this->scheduleRetry($delivery);
            }
        } catch (\Exception $e) {
            Log::error('Webhook delivery failed', [
                'delivery_id' => $delivery->id,
                'webhook_id' => $webhook->id,
                'error' => $e->getMessage(),
            ]);

            $delivery->response_code = $delivery->response_code ?? 0;
            $this->scheduleRetry($delivery);
        }

        $delivery->save();

        return $delivery;
    }

    /**
     * Schedule a retry for a failed delivery.
     */
    protected function scheduleRetry(WebhookDelivery $delivery): void
    {
        if ($delivery->attempts < $this->maxAttempts) {
            // Exponential backoff: 30s, 2m, 8m
            $delaySeconds = 30 * (4 ** ($delivery->attempts - 1));
            $delivery->next_retry_at = now()->addSeconds($delaySeconds);
        } else {
            $delivery->next_retry_at = null;
        }
    }

    /**
     * Retry all pending webhook deliveries.
     *
     * @return int Number of deliveries retried.
     */
    public function retryPending(): int
    {
        $deliveries = WebhookDelivery::whereNull('delivered_at')
            ->whereNotNull('next_retry_at')
            ->where('next_retry_at', '<=', now())
            ->where('attempts', '<', $this->maxAttempts)
            ->get();

        foreach ($deliveries as $delivery) {
            $this->attemptDelivery($delivery);
        }

        return $deliveries->count();
    }

    /**
     * Verify a webhook signature.
     */
    public static function verifySignature(string $payload, string $signature, string $secret): bool
    {
        $expected = hash_hmac('sha256', $payload, $secret);

        return hash_equals($expected, $signature);
    }
}
