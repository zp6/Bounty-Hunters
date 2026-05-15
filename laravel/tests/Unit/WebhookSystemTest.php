<?php

namespace Tests\Unit;

use App\Models\Webhook;
use App\Models\WebhookDelivery;
use App\Services\WebhookDispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class WebhookSystemTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_can_create_a_webhook()
    {
        $webhook = Webhook::create([
            'url' => 'https://example.com/webhook',
            'secret' => Str::random(32),
            'events' => ['order.created', 'order.updated'],
            'active' => true,
        ]);

        $this->assertDatabaseHas('webhooks', [
            'id' => $webhook->id,
            'url' => 'https://example.com/webhook',
            'active' => true,
        ]);
    }

    /** @test */
    public function it_can_check_if_webhook_handles_event()
    {
        $webhook = Webhook::create([
            'url' => 'https://example.com/webhook',
            'secret' => 'secret',
            'events' => ['order.created'],
            'active' => true,
        ]);

        $this->assertTrue($webhook->handlesEvent('order.created'));
        $this->assertFalse($webhook->handlesEvent('order.deleted'));
    }

    /** @test */
    public function it_handles_wildcard_events()
    {
        $webhook = Webhook::create([
            'url' => 'https://example.com/webhook',
            'secret' => 'secret',
            'events' => ['*'],
            'active' => true,
        ]);

        $this->assertTrue($webhook->handlesEvent('any.event'));
    }

    /** @test */
    public function inactive_webhook_does_not_handle_events()
    {
        $webhook = Webhook::create([
            'url' => 'https://example.com/webhook',
            'secret' => 'secret',
            'events' => ['order.created'],
            'active' => false,
        ]);

        $this->assertFalse($webhook->handlesEvent('order.created'));
    }

    /** @test */
    public function it_creates_delivery_record()
    {
        Http::fake([
            'example.com/*' => Http::response(['ok' => true], 200),
        ]);

        $webhook = Webhook::create([
            'url' => 'https://example.com/webhook',
            'secret' => 'test-secret',
            'events' => ['test.event'],
            'active' => true,
        ]);

        $dispatcher = new WebhookDispatcher();
        $deliveries = $dispatcher->dispatch('test.event', ['key' => 'value']);

        $this->assertCount(1, $deliveries);
        $this->assertEquals(200, $deliveries[0]->response_code);
        $this->assertNotNull($deliveries[0]->delivered_at);
    }

    /** @test */
    public function it_sends_signature_header()
    {
        Http::fake([
            'example.com/*' => Http::response(['ok' => true], 200),
        ]);

        $webhook = Webhook::create([
            'url' => 'https://example.com/webhook',
            'secret' => 'test-secret',
            'events' => ['test.event'],
            'active' => true,
        ]);

        $dispatcher = new WebhookDispatcher();
        $dispatcher->dispatch('test.event', []);

        Http::assertSent(function ($request) {
            return $request->hasHeader('X-Webhook-Signature')
                && $request->hasHeader('X-Webhook-Event', 'test.event');
        });
    }

    /** @test */
    public function it_schedules_retry_on_failure()
    {
        Http::fake([
            'example.com/*' => Http::response(['error' => true], 500),
        ]);

        $webhook = Webhook::create([
            'url' => 'https://example.com/webhook',
            'secret' => 'test-secret',
            'events' => ['test.event'],
            'active' => true,
        ]);

        $dispatcher = new WebhookDispatcher();
        $deliveries = $dispatcher->dispatch('test.event');

        $delivery = $deliveries[0];
        $this->assertEquals(500, $delivery->response_code);
        $this->assertNull($delivery->delivered_at);
        $this->assertNotNull($delivery->next_retry_at);
        $this->assertEquals(1, $delivery->attempts);
    }

    /** @test */
    public function it_verifies_signature()
    {
        $payload = json_encode(['test' => 'data']);
        $secret = 'my-secret';
        $signature = hash_hmac('sha256', $payload, $secret);

        $this->assertTrue(
            WebhookDispatcher::verifySignature($payload, $signature, $secret)
        );
        $this->assertFalse(
            WebhookDispatcher::verifySignature($payload, 'wrong-signature', $secret)
        );
    }

    /** @test */
    public function delivery_belongs_to_webhook()
    {
        $webhook = Webhook::create([
            'url' => 'https://example.com/webhook',
            'secret' => 'secret',
            'events' => null,
            'active' => true,
        ]);

        $delivery = WebhookDelivery::create([
            'webhook_id' => $webhook->id,
            'event' => 'test.event',
            'payload' => ['test' => true],
            'attempts' => 1,
        ]);

        $this->assertEquals($webhook->id, $delivery->webhook->id);
    }

    /** @test */
    public function delivery_checks_success()
    {
        $delivery = new WebhookDelivery(['response_code' => 200]);
        $this->assertTrue($delivery->isSuccessful());

        $delivery = new WebhookDelivery(['response_code' => 500]);
        $this->assertFalse($delivery->isSuccessful());
    }
}
