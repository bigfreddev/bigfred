<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ManualOrderCreationTest extends TestCase
{
    use DatabaseTransactions;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create();

        $this->admin->forceFill([
            'is_admin' => true,
        ])->save();

        $this->actingAs($this->admin, 'sanctum');
    }

    private function createProduct(int $stock = 10): Product
    {
        $suffix = Str::lower(Str::random(8));

        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Manual Order Category ' . $suffix,
            'slug' => 'manual-order-category-' . $suffix,
            'is_active' => true,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Product::create([
            'category_id' => $categoryId,
            'name' => 'Manual Order Test Product',
            'slug' => 'manual-order-product-' . $suffix,
            'sku' => 'BF-' . Str::upper(Str::random(8)),
            'price' => 50.00,
            'stock_quantity' => $stock,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
    }

    public function test_admin_can_create_manual_order_with_promotion_and_stock_is_deducted(): void
    {
        $product = $this->createProduct(10);

        $promotion = Promotion::create([
            'name' => 'Manual Order 20 Percent Test',
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 20,
            'applies_to_all_products' => true,
            'free_delivery' => false,
            'can_combine' => false,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'is_enabled' => true,
        ]);

        $response = $this->postJson('/api/admin/orders', [
            'customer_name' => 'Manual Test Customer',
            'customer_phone' => '024' . Str::random(7),
            'delivery_address' => 'Accra, Ghana',
            'delivery_location' => 'Accra',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                ],
            ],
        ]);

        $response->assertCreated();

        $orderId = $response->json('order.id');

        $this->assertNotNull($orderId);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'source' => 'manual',
            'status' => 'confirmed',
            'subtotal' => '100.00',
            'product_discount_amount' => '20.00',
            'total' => '80.00',
            'promotion_id' => $promotion->id,
            'promotion_name' => $promotion->name,
        ]);

        $this->assertDatabaseHas('order_promotions', [
            'order_id' => $orderId,
            'promotion_id' => $promotion->id,
            'promotion_name' => $promotion->name,
            'product_discount_amount' => '20.00',
        ]);

        $this->assertDatabaseHas('order_items', [
            'order_id' => $orderId,
            'product_id' => $product->id,
            'original_unit_price' => '50.00',
            'discount_amount' => '20.00',
            'quantity' => 2,
            'line_total' => '80.00',
        ]);

        $this->assertSame(8, $product->fresh()->stock_quantity);

        // The original product price must remain unchanged.
        $this->assertSame('50.00', $product->fresh()->price);
    }

    public function test_manual_order_uses_delivery_zone_fee_and_free_delivery_promotion(): void
    {
        $product = $this->createProduct();

        $zone = DeliveryZone::create([
            'name' => 'Manual Test Delivery Zone ' . Str::upper(Str::random(5)),
            'description' => 'Test delivery zone',
            'delivery_fee' => 12.50,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $promotion = Promotion::create([
            'name' => 'Manual Test Free Delivery',
            'discount_type' => null,
            'discount_application' => 'per_unit',
            'discount_value' => null,
            'applies_to_all_products' => false,
            'free_delivery' => true,
            'can_combine' => false,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDay(),
            'is_enabled' => true,
        ]);

        $promotion->deliveryZones()->attach($zone->id);

        $response = $this->postJson('/api/admin/orders', [
            'customer_name' => 'Free Delivery Test Customer',
            'customer_phone' => '024' . Str::random(7),
            'delivery_address' => 'Test Address, Accra',
            'delivery_location' => $zone->name,
            'delivery_zone_id' => $zone->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertCreated();

        $orderId = $response->json('order.id');

        $this->assertNotNull($orderId);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'delivery_zone_id' => $zone->id,
            'delivery_zone_name' => $zone->name,
            'original_delivery_fee' => '12.50',
            'delivery_discount_amount' => '12.50',
            'delivery_fee' => '0.00',
            'subtotal' => '50.00',
            'total' => '50.00',
        ]);

        $this->assertDatabaseHas('order_promotions', [
            'order_id' => $orderId,
            'promotion_id' => $promotion->id,
            'delivery_discount_amount' => '12.50',
        ]);

        $this->assertSame(9, $product->fresh()->stock_quantity);
    }

    public function test_manual_order_outside_listed_delivery_zones_requires_delivery_quote(): void
    {
        $product = $this->createProduct();

        $response = $this->postJson('/api/admin/orders', [
            'customer_name' => 'Outside Zone Test Customer',
            'customer_phone' => '024' . Str::random(7),
            'delivery_address' => 'An area outside the listed zones',
            'delivery_location' => 'Outside listed areas',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                ],
            ],
        ]);

        $response->assertCreated();

        $orderId = $response->json('order.id');

        $this->assertNotNull($orderId);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'delivery_zone_id' => null,
            'delivery_quote_pending' => true,
            'original_delivery_fee' => '0.00',
            'delivery_fee' => '0.00',
            'subtotal' => '50.00',
            'total' => '50.00',
        ]);

        $this->assertSame(9, $product->fresh()->stock_quantity);
    }
}