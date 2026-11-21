<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\OrderPromotion;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PromotionManagementTest extends TestCase
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

    private function uniqueName(string $prefix = 'Test Promotion'): string
    {
        return $prefix . ' ' . Str::upper(Str::random(8));
    }

    private function createProduct(float $price = 100): Product
    {
        $suffix = Str::lower(Str::random(8));

        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Promotion Test ' . $suffix,
            'slug' => 'promotion-test-' . $suffix,
            'is_active' => true,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Product::create([
            'category_id' => $categoryId,
            'name' => 'Promotion Product ' . $suffix,
            'slug' => 'promotion-product-' . $suffix,
            'sku' => 'BF-' . Str::upper(Str::random(8)),
            'price' => $price,
            'stock_quantity' => 20,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
    }

    private function createZone(float $fee = 15): DeliveryZone
    {
        return DeliveryZone::create([
            'name' => $this->uniqueName('Test Zone'),
            'description' => 'Promotion management test zone',
            'delivery_fee' => $fee,
            'is_active' => true,
            'sort_order' => 0,
        ]);
    }

    private function createPromotion(array $overrides = []): Promotion
    {
        return Promotion::create(array_merge([
            'name' => $this->uniqueName(),
            'description' => 'Promotion management test',
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 20,
            'applies_to_all_products' => true,
            'free_delivery' => false,
            'can_combine' => false,
            'minimum_order_value' => null,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(),
            'is_enabled' => true,
        ], $overrides));
    }

    public function test_admin_can_create_percentage_promotion(): void
    {
        $name = $this->uniqueName();

        $response = $this->postJson('/api/admin/promotions', [
            'name' => $name,
            'description' => 'Twenty percent discount',
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 20,
            'applies_to_all_products' => true,
            'free_delivery' => false,
            'can_combine' => false,
            'starts_at' => now()->subHour()->toDateTimeString(),
            'ends_at' => now()->addDays(7)->toDateTimeString(),
            'is_enabled' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', $name)
            ->assertJsonPath('data.discount_type', 'percentage');

        $this->assertDatabaseHas('promotions', [
            'name' => $name,
            'discount_type' => 'percentage',
            'discount_value' => '20.00',
            'is_enabled' => 1,
        ]);
    }

    public function test_admin_can_create_fixed_per_order_promotion(): void
    {
        $name = $this->uniqueName();

        $response = $this->postJson('/api/admin/promotions', [
            'name' => $name,
            'discount_type' => 'fixed',
            'discount_application' => 'per_order',
            'discount_value' => 10,
            'applies_to_all_products' => true,
            'free_delivery' => false,
            'starts_at' => now()->subHour()->toDateTimeString(),
            'ends_at' => now()->addDays(5)->toDateTimeString(),
            'is_enabled' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', $name)
            ->assertJsonPath('data.discount_application', 'per_order');

        $this->assertDatabaseHas('promotions', [
            'name' => $name,
            'discount_type' => 'fixed',
            'discount_application' => 'per_order',
            'discount_value' => '10.00',
        ]);
    }

    public function test_admin_can_create_product_specific_discount_override(): void
    {
        $product = $this->createProduct();
        $name = $this->uniqueName();

        $response = $this->postJson('/api/admin/promotions', [
            'name' => $name,
            'discount_type' => null,
            'discount_value' => null,
            'applies_to_all_products' => false,
            'free_delivery' => false,
            'starts_at' => now()->subHour()->toDateTimeString(),
            'ends_at' => now()->addDays(5)->toDateTimeString(),
            'products' => [
                [
                    'product_id' => $product->id,
                    'discount_type' => 'percentage',
                    'discount_application' => 'per_unit',
                    'discount_value' => 15,
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('promotion_products', [
            'product_id' => $product->id,
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => '15.00',
        ]);
    }

    public function test_admin_can_create_free_delivery_promotion_for_selected_zone(): void
    {
        $zone = $this->createZone();
        $name = $this->uniqueName();

        $response = $this->postJson('/api/admin/promotions', [
            'name' => $name,
            'discount_type' => null,
            'discount_value' => null,
            'applies_to_all_products' => true,
            'free_delivery' => true,
            'delivery_zone_ids' => [$zone->id],
            'starts_at' => now()->subHour()->toDateTimeString(),
            'ends_at' => now()->addDays(5)->toDateTimeString(),
            'is_enabled' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.free_delivery', true);

        $this->assertDatabaseHas('promotion_delivery_zones', [
            'delivery_zone_id' => $zone->id,
        ]);
    }

    public function test_percentage_discount_above_100_is_rejected(): void
    {
        $response = $this->postJson('/api/admin/promotions', [
            'name' => $this->uniqueName(),
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 120,
            'applies_to_all_products' => true,
            'free_delivery' => false,
            'starts_at' => now()->subHour()->toDateTimeString(),
            'ends_at' => now()->addDays(5)->toDateTimeString(),
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['discount_value']);
    }

    public function test_end_date_must_be_later_than_start_date(): void
    {
        $response = $this->postJson('/api/admin/promotions', [
            'name' => $this->uniqueName(),
            'discount_type' => 'percentage',
            'discount_value' => 10,
            'starts_at' => now()->addDays(5)->toDateTimeString(),
            'ends_at' => now()->addDays(2)->toDateTimeString(),
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['ends_at']);
    }

    public function test_admin_can_filter_promotions_by_status(): void
    {
        $active = $this->createPromotion();

        $scheduled = $this->createPromotion([
            'starts_at' => now()->addDays(2),
            'ends_at' => now()->addDays(5),
        ]);

        $expired = $this->createPromotion([
            'starts_at' => now()->subDays(5),
            'ends_at' => now()->subDay(),
        ]);

        $disabled = $this->createPromotion([
            'is_enabled' => false,
        ]);

        $this->getJson('/api/admin/promotions?status=active')
            ->assertOk()
            ->assertJsonFragment(['name' => $active->name])
            ->assertJsonMissing(['name' => $scheduled->name])
            ->assertJsonMissing(['name' => $expired->name])
            ->assertJsonMissing(['name' => $disabled->name]);

        $this->getJson('/api/admin/promotions?status=scheduled')
            ->assertOk()
            ->assertJsonFragment(['name' => $scheduled->name]);

        $this->getJson('/api/admin/promotions?status=expired')
            ->assertOk()
            ->assertJsonFragment(['name' => $expired->name]);

        $this->getJson('/api/admin/promotions?status=disabled')
            ->assertOk()
            ->assertJsonFragment(['name' => $disabled->name]);
    }

    public function test_admin_can_update_promotion_and_sync_products_and_zones(): void
    {
        $promotion = $this->createPromotion();
        $product = $this->createProduct();
        $zone = $this->createZone();

        $updatedName = $this->uniqueName('Updated Promotion');

        $response = $this->putJson(
            "/api/admin/promotions/{$promotion->id}",
            [
                'name' => $updatedName,
                'products' => [
                    [
                        'product_id' => $product->id,
                        'discount_type' => 'fixed',
                        'discount_application' => 'per_unit',
                        'discount_value' => 5,
                    ],
                ],
                'delivery_zone_ids' => [$zone->id],
            ]
        );

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', $updatedName);

        $this->assertDatabaseHas('promotions', [
            'id' => $promotion->id,
            'name' => $updatedName,
        ]);

        $this->assertDatabaseHas('promotion_products', [
            'promotion_id' => $promotion->id,
            'product_id' => $product->id,
            'discount_type' => 'fixed',
            'discount_value' => '5.00',
        ]);

        $this->assertDatabaseHas('promotion_delivery_zones', [
            'promotion_id' => $promotion->id,
            'delivery_zone_id' => $zone->id,
        ]);
    }

    public function test_admin_can_enable_and_disable_promotion(): void
    {
        $promotion = $this->createPromotion();

        $this->patchJson(
            "/api/admin/promotions/{$promotion->id}/status",
            ['is_enabled' => false]
        )->assertOk()
            ->assertJsonPath('status', 'disabled');

        $this->assertDatabaseHas('promotions', [
            'id' => $promotion->id,
            'is_enabled' => 0,
        ]);

        $this->patchJson(
            "/api/admin/promotions/{$promotion->id}/status",
            ['is_enabled' => true]
        )->assertOk()
            ->assertJsonPath('status', 'active');

        $this->assertDatabaseHas('promotions', [
            'id' => $promotion->id,
            'is_enabled' => 1,
        ]);
    }

    public function test_deleting_promotion_preserves_order_promotion_history(): void
    {
        $promotion = $this->createPromotion();

        $order = Order::create([
            'order_number' => 'BF-PROMO-' . Str::upper(Str::random(8)),
            'customer_name' => 'Promotion History Customer',
            'customer_phone' => '024' . random_int(1000000, 9999999),
            'delivery_address' => 'Promotion History Test Address, Accra',
            'delivery_location' => 'Test Delivery Area',
            'source' => 'website',
            'status' => 'confirmed',
            'subtotal' => 100,
            'product_discount_amount' => 20,
            'original_delivery_fee' => 15,
            'delivery_fee' => 15,
            'total' => 95,
            'payment_status' => 'unpaid',
        ]);

        $history = OrderPromotion::create([
            'order_id' => $order->id,
            'promotion_id' => $promotion->id,
            'promotion_name' => $promotion->name,
            'product_discount_amount' => 20,
            'delivery_discount_amount' => 0,
            'total_discount_amount' => 20,
        ]);

        $response = $this->deleteJson(
            "/api/admin/promotions/{$promotion->id}"
        );

        $response->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('promotions', [
            'id' => $promotion->id,
        ]);

        $this->assertDatabaseHas('order_promotions', [
            'id' => $history->id,
            'promotion_id' => null,
            'promotion_name' => $promotion->name,
            'total_discount_amount' => '20.00',
        ]);
    }

    public function test_unauthenticated_user_cannot_manage_promotions(): void
    {
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/admin/promotions')
            ->assertUnauthorized();
    }
}
