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

class PromotionPreviewTest extends TestCase
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

    private function uniqueName(string $prefix = 'Preview Test'): string
    {
        return $prefix . ' ' . Str::upper(Str::random(8));
    }

    private function createProduct(float $price = 100): Product
    {
        $suffix = Str::lower(Str::random(8));

        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Preview Test ' . $suffix,
            'slug' => 'preview-test-' . $suffix,
            'is_active' => true,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Product::create([
            'category_id' => $categoryId,
            'name' => 'Preview Product ' . $suffix,
            'slug' => 'preview-product-' . $suffix,
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
            'name' => $this->uniqueName('Preview Zone'),
            'description' => 'Promotion preview test zone',
            'delivery_fee' => $fee,
            'is_active' => true,
            'sort_order' => 0,
        ]);
    }

    private function draftPromotion(array $overrides = []): array
    {
        return array_merge([
            'name' => $this->uniqueName(),
            'description' => 'Promotion preview test',
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 20,
            'applies_to_all_products' => true,
            'free_delivery' => false,
            'can_combine' => false,
            'minimum_order_value' => null,
            'starts_at' => now()->subHour()->toDateTimeString(),
            'ends_at' => now()->addDays(7)->toDateTimeString(),
            'is_enabled' => true,
        ], $overrides);
    }

    private function previewPayload(
        Product $product,
        array $promotion,
        int $quantity = 1,
        ?DeliveryZone $zone = null
    ): array {
        return array_merge($promotion, [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                ],
            ],
            'delivery_zone_id' => $zone?->id,
        ]);
    }

    public function test_admin_can_preview_draft_storewide_percentage_discount(): void
    {
        $product = $this->createProduct(100);

        $payload = $this->previewPayload(
            $product,
            $this->draftPromotion(),
            2
        );

        $response = $this->postJson('/api/admin/promotions/preview', $payload);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('preview_mode', 'draft')
            ->assertJsonPath('data.subtotal', 200)
            ->assertJsonPath('data.product_discount_amount', 40)
            ->assertJsonPath('data.total', 160)
            ->assertJsonPath('data.items.0.original_unit_price', 100)
            ->assertJsonPath('data.items.0.discount_amount', 40)
            ->assertJsonPath('data.applied_promotions.0.promotion_id', null);

        $this->assertSame(100.0, (float) $product->fresh()->price);
    }

    public function test_admin_can_preview_product_specific_discount_override(): void
    {
        $product = $this->createProduct(100);

        $promotion = $this->draftPromotion([
            'discount_type' => null,
            'discount_value' => null,
            'applies_to_all_products' => false,
            'products' => [
                [
                    'product_id' => $product->id,
                    'discount_type' => 'percentage',
                    'discount_application' => 'per_unit',
                    'discount_value' => 15,
                ],
            ],
        ]);

        $response = $this->postJson(
            '/api/admin/promotions/preview',
            $this->previewPayload($product, $promotion, 2)
        );

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('preview_mode', 'draft')
            ->assertJsonPath('data.subtotal', 200)
            ->assertJsonPath('data.product_discount_amount', 30)
            ->assertJsonPath('data.total', 170);

        $this->assertSame(100.0, (float) $product->fresh()->price);
    }

    public function test_admin_can_preview_fixed_per_order_discount(): void
    {
        $product = $this->createProduct(100);

        $promotion = $this->draftPromotion([
            'discount_type' => 'fixed',
            'discount_application' => 'per_order',
            'discount_value' => 15,
        ]);

        $response = $this->postJson(
            '/api/admin/promotions/preview',
            $this->previewPayload($product, $promotion, 3)
        );

        $response->assertOk()
            ->assertJsonPath('data.subtotal', 300)
            ->assertJsonPath('data.product_discount_amount', 15)
            ->assertJsonPath('data.total', 285);
    }

    public function test_admin_can_preview_free_delivery_for_assigned_zone(): void
    {
        $product = $this->createProduct(100);
        $zone = $this->createZone(15);

        $promotion = $this->draftPromotion([
            'discount_type' => null,
            'discount_value' => null,
            'free_delivery' => true,
            'delivery_zone_ids' => [$zone->id],
        ]);

        $response = $this->postJson(
            '/api/admin/promotions/preview',
            $this->previewPayload($product, $promotion, 1, $zone)
        );

        $response->assertOk()
            ->assertJsonPath('data.subtotal', 100)
            ->assertJsonPath('data.original_delivery_fee', 15)
            ->assertJsonPath('data.delivery_discount_amount', 15)
            ->assertJsonPath('data.delivery_fee', 0)
            ->assertJsonPath('data.total', 100);
    }

    public function test_admin_can_preview_free_delivery_combined_with_product_discount(): void
    {
        $product = $this->createProduct(100);
        $zone = $this->createZone(15);

        $promotion = $this->draftPromotion([
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 10,
            'free_delivery' => true,
            'can_combine' => true,
            'delivery_zone_ids' => [$zone->id],
        ]);

        $response = $this->postJson(
            '/api/admin/promotions/preview',
            $this->previewPayload($product, $promotion, 2, $zone)
        );

        $response->assertOk()
            ->assertJsonPath('data.subtotal', 200)
            ->assertJsonPath('data.product_discount_amount', 20)
            ->assertJsonPath('data.original_delivery_fee', 15)
            ->assertJsonPath('data.delivery_discount_amount', 15)
            ->assertJsonPath('data.delivery_fee', 0)
            ->assertJsonPath('data.total', 180);
    }

    public function test_admin_can_preview_existing_active_promotions(): void
    {
        $product = $this->createProduct(100);

        $promotion = Promotion::create([
            'name' => $this->uniqueName('Active Preview'),
            'description' => 'Existing active promotion',
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 25,
            'applies_to_all_products' => true,
            'free_delivery' => false,
            'can_combine' => false,
            'minimum_order_value' => null,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addDays(7),
            'is_enabled' => true,
        ]);

        $response = $this->postJson('/api/admin/promotions/preview', [
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('preview_mode', 'active_promotions')
            ->assertJsonPath('data.subtotal', 200)
            ->assertJsonPath('data.product_discount_amount', 50)
            ->assertJsonPath('data.total', 150)
            ->assertJsonPath('data.applied_promotions.0.promotion_id', $promotion->id);
    }

    public function test_draft_preview_does_not_save_promotion_or_change_product_price(): void
    {
        $product = $this->createProduct(125);
        $name = $this->uniqueName('Unsaved Preview');

        $promotion = $this->draftPromotion([
            'name' => $name,
        ]);

        $response = $this->postJson(
            '/api/admin/promotions/preview',
            $this->previewPayload($product, $promotion, 2)
        );

        $response->assertOk();

        $this->assertDatabaseMissing('promotions', [
            'name' => $name,
        ]);

        $this->assertSame(125.0, (float) $product->fresh()->price);
    }

    public function test_preview_requires_at_least_one_item(): void
    {
        $response = $this->postJson('/api/admin/promotions/preview', [
            'items' => [],
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);
    }

    public function test_preview_rejects_inactive_product(): void
    {
        $product = $this->createProduct();

        $product->update([
            'is_active' => false,
        ]);

        $response = $this->postJson(
            '/api/admin/promotions/preview',
            $this->previewPayload(
                $product,
                $this->draftPromotion()
            )
        );

        $response->assertUnprocessable();
    }

    public function test_preview_rejects_inactive_delivery_zone(): void
    {
        $product = $this->createProduct();
        $zone = $this->createZone();

        $zone->update([
            'is_active' => false,
        ]);

        $promotion = $this->draftPromotion([
            'discount_type' => null,
            'discount_value' => null,
            'free_delivery' => true,
            'delivery_zone_ids' => [$zone->id],
        ]);

        $response = $this->postJson(
            '/api/admin/promotions/preview',
            $this->previewPayload($product, $promotion, 1, $zone)
        );

        $response->assertUnprocessable();
    }

    public function test_unauthenticated_user_cannot_preview_promotions(): void
    {
        $this->app['auth']->forgetGuards();

        $this->app['auth']->shouldUse('web');

        $product = $this->createProduct();

        $response = $this->postJson(
            '/api/admin/promotions/preview',
            $this->previewPayload(
                $product,
                $this->draftPromotion()
            )
        );

        $response->assertUnauthorized();
    }
}