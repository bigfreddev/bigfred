<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerCheckoutTest extends TestCase
{
    use DatabaseTransactions;

    protected User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->customer = User::factory()->create();

        $this->customer->forceFill([
            'is_admin' => false,
        ])->save();

        $this->actingAs($this->customer, 'sanctum');
    }

    private function createProduct(
        float $price = 100.00,
        int $stock = 10
    ): Product {
        $suffix = Str::lower(Str::random(8));

        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Checkout Category ' . $suffix,
            'slug' => 'checkout-category-' . $suffix,
            'is_active' => true,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Product::create([
            'category_id' => $categoryId,
            'name' => 'Checkout Product ' . $suffix,
            'slug' => 'checkout-product-' . $suffix,
            'sku' => 'BF-' . Str::upper(Str::random(8)),
            'price' => $price,
            'stock_quantity' => $stock,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
    }

    private function createDeliveryZone(
        float $fee = 20.00
    ): DeliveryZone {
        return DeliveryZone::create([
            'name' => 'Test Zone ' . Str::upper(Str::random(6)),
            'description' => 'Checkout test delivery zone',
            'delivery_fee' => $fee,
            'is_active' => true,
            'sort_order' => 0,
        ]);
    }

    private function createPromotion(array $attributes = []): Promotion
    {
        return Promotion::create(array_merge([
            'name' => 'Test Promotion ' . Str::upper(Str::random(6)),
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 10,
            'applies_to_all_products' => true,
            'free_delivery' => false,
            'can_combine' => false,
            'minimum_order_value' => null,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDays(7),
            'is_enabled' => true,
        ], $attributes));
    }

    private function checkoutPayload(
        Product $product,
        int $quantity = 1,
        ?int $deliveryZoneId = null
    ): array {
        return [
            'customer_phone' => '0240000000',
            'delivery_address' => 'Accra, Ghana',
            'delivery_location' => 'Test neighbourhood',
            'delivery_zone_id' => $deliveryZoneId,
            'customer_notes' => 'Please call on arrival.',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                ],
            ],
        ];
    }

    public function test_unauthenticated_customer_cannot_place_order(): void
    {
        auth('sanctum')->forgetUser();

        $this->app['auth']->forgetGuards();

        $product = $this->createProduct();

        $response = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product)
        );

        $response->assertUnauthorized();

        $this->assertDatabaseMissing('orders', [
            'customer_phone' => '0240000000',
            'delivery_address' => 'Accra, Ghana',
            'delivery_location' => 'Test neighbourhood',
        ]);
    }

    public function test_authenticated_customer_can_place_order(): void
    {
        $product = $this->createProduct(100, 10);

        $response = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 2)
        );

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('order.source', 'website')
            ->assertJsonPath('order.status', 'awaiting_confirmation')
            ->assertJsonPath('order.subtotal', '200.00')
            ->assertJsonPath('order.total', '200.00');

        $this->assertDatabaseHas('orders', [
            'user_id' => $this->customer->id,
            'source' => 'website',
            'status' => 'awaiting_confirmation',
            'subtotal' => 200.00,
            'total' => 200.00,
        ]);

        $this->assertSame(
            10,
            $product->fresh()->stock_quantity
        );
    }

    public function test_storewide_percentage_discount_is_saved_on_order(): void
    {
        $product = $this->createProduct(100);

        $promotion = $this->createPromotion([
            'discount_value' => 20,
        ]);

        $response = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 2)
        );

        $response->assertCreated()
            ->assertJsonPath('order.subtotal', '200.00')
            ->assertJsonPath('order.product_discount_amount', '40.00')
            ->assertJsonPath('order.total', '160.00');

        $this->assertDatabaseHas('orders', [
            'promotion_id' => $promotion->id,
            'promotion_name' => $promotion->name,
            'product_discount_amount' => 40.00,
            'total' => 160.00,
        ]);

        $this->assertDatabaseHas('order_items', [
            'product_id' => $product->id,
            'original_unit_price' => 100.00,
            'discount_amount' => 40.00,
            'line_total' => 160.00,
        ]);

        $this->assertDatabaseHas('order_promotions', [
            'promotion_id' => $promotion->id,
            'promotion_name' => $promotion->name,
            'product_discount_amount' => 40.00,
        ]);

        $this->assertSame(
            100.00,
            (float) $product->fresh()->price
        );
    }

    public function test_product_specific_discount_overrides_storewide_discount(): void
    {
        $product = $this->createProduct(100);

        $promotion = $this->createPromotion([
            'discount_value' => 50,
        ]);

        $promotion->products()->attach($product->id, [
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 15,
        ]);

        $response = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 2)
        );

        $response->assertCreated()
            ->assertJsonPath('order.subtotal', '200.00')
            ->assertJsonPath('order.product_discount_amount', '30.00')
            ->assertJsonPath('order.total', '170.00');
    }

    public function test_delivery_fee_is_calculated_from_selected_zone(): void
    {
        $product = $this->createProduct(100);
        $zone = $this->createDeliveryZone(25);

        $response = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 1, $zone->id)
        );

        $response->assertCreated()
            ->assertJsonPath('order.subtotal', '100.00')
            ->assertJsonPath('order.original_delivery_fee', '25.00')
            ->assertJsonPath('order.delivery_fee', '25.00')
            ->assertJsonPath('order.total', '125.00')
            ->assertJsonPath('order.delivery_quote_pending', false);

        $this->assertDatabaseHas('orders', [
            'delivery_zone_id' => $zone->id,
            'delivery_zone_name' => $zone->name,
            'original_delivery_fee' => 25.00,
            'delivery_fee' => 25.00,
            'total' => 125.00,
        ]);
    }

    public function test_free_delivery_applies_only_to_selected_zone(): void
    {
        $product = $this->createProduct(100);
        $eligibleZone = $this->createDeliveryZone(25);
        $otherZone = $this->createDeliveryZone(30);

        $promotion = $this->createPromotion([
            'free_delivery' => true,
            'discount_type' => null,
            'discount_value' => null,
        ]);

        $promotion->deliveryZones()->attach($eligibleZone->id);

        $eligibleResponse = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 1, $eligibleZone->id)
        );

        $eligibleResponse->assertCreated()
            ->assertJsonPath('order.original_delivery_fee', '25.00')
            ->assertJsonPath('order.delivery_discount_amount', '25.00')
            ->assertJsonPath('order.delivery_fee', '0.00')
            ->assertJsonPath('order.total', '100.00');

        $otherResponse = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 1, $otherZone->id)
        );

        $otherResponse->assertCreated()
            ->assertJsonPath('order.original_delivery_fee', '30.00')
            ->assertJsonPath('order.delivery_discount_amount', '0.00')
            ->assertJsonPath('order.delivery_fee', '30.00')
            ->assertJsonPath('order.total', '130.00');

        $this->assertDatabaseHas('order_promotions', [
            'promotion_id' => $promotion->id,
            'delivery_discount_amount' => 25.00,
        ]);
    }

    public function test_other_delivery_area_requires_manual_delivery_quote(): void
    {
        $product = $this->createProduct(100);

        $response = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product)
        );

        $response->assertCreated()
            ->assertJsonPath('order.delivery_zone_id', null)
            ->assertJsonPath('order.delivery_quote_pending', true)
            ->assertJsonPath('order.original_delivery_fee', '0.00')
            ->assertJsonPath('order.delivery_fee', '0.00')
            ->assertJsonPath('order.total', '100.00');

        $this->assertDatabaseHas('orders', [
            'id' => $response->json('order.id'),
            'delivery_quote_pending' => true,
            'delivery_zone_id' => null,
        ]);
    }

    public function test_customer_cannot_select_inactive_delivery_zone(): void
    {
        $product = $this->createProduct();
        $zone = $this->createDeliveryZone();

        $zone->update([
            'is_active' => false,
        ]);

        $response = $this->postJson(
            '/api/orders',
            $this->checkoutPayload($product, 1, $zone->id)
        );

        $response->assertUnprocessable();

        $this->assertDatabaseMissing('orders', [
            'customer_phone' => '0240000000',
            'delivery_address' => 'Accra, Ghana',
            'delivery_location' => 'Test neighbourhood',
        ]);
    }

    public function test_customer_cannot_submit_their_own_delivery_fee(): void
    {
        $product = $this->createProduct(100);
        $zone = $this->createDeliveryZone(25);

        $payload = $this->checkoutPayload($product, 1, $zone->id);

        $payload['delivery_fee'] = 0;
        $payload['total'] = 1;

        $response = $this->postJson('/api/orders', $payload);

        $response->assertCreated()
            ->assertJsonPath('order.delivery_fee', '25.00')
            ->assertJsonPath('order.total', '125.00');
    }
}
