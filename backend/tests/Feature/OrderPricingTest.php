<?php

namespace Tests\Feature;

use App\Models\DeliveryZone;
use App\Models\Product;
use App\Models\Promotion;
use App\Services\OrderPricingService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderPricingTest extends TestCase
{
    use DatabaseTransactions;

    private OrderPricingService $pricingService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->pricingService = app(OrderPricingService::class);
    }

    private function createProduct(float $price = 50.00): Product
    {
        $suffix = Str::lower(Str::random(8));

        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Pricing Test ' . $suffix,
            'slug' => 'pricing-test-' . $suffix,
            'is_active' => true,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Product::create([
            'category_id' => $categoryId,
            'name' => 'Pricing Product ' . $suffix,
            'slug' => 'pricing-product-' . $suffix,
            'sku' => 'BF-' . Str::upper(Str::random(8)),
            'price' => $price,
            'stock_quantity' => 20,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
    }

    private function createPromotion(array $overrides = []): Promotion
    {
        return Promotion::create(array_merge([
            'name' => 'Test Promotion ' . Str::upper(Str::random(6)),
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

    private function calculate(
        array $products,
        ?DeliveryZone $zone = null
    ): array {
        return $this->pricingService->calculate(
            $products,
            $zone
        );
    }

    public function test_storewide_percentage_discount_is_calculated(): void
    {
        $product = $this->createProduct(100);

        $this->createPromotion([
            'discount_type' => 'percentage',
            'discount_value' => 20,
        ]);

        $result = $this->calculate([
            ['product' => $product, 'quantity' => 2],
        ]);

        $this->assertSame(200.00, $result['subtotal']);
        $this->assertSame(40.00, $result['product_discount_amount']);
        $this->assertSame(160.00, $result['total']);
        $this->assertSame(1, count($result['applied_promotions']));

        $this->assertSame(
            100.00,
            (float) $product->fresh()->price
        );
    }

    public function test_product_specific_discount_overrides_storewide_discount(): void
    {
        $product = $this->createProduct(100);

        $promotion = $this->createPromotion([
            'discount_type' => 'percentage',
            'discount_value' => 50,
        ]);

        $promotion->products()->attach($product->id, [
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 10,
        ]);

        $result = $this->calculate([
            ['product' => $product, 'quantity' => 1],
        ]);

        $this->assertSame(10.00, $result['product_discount_amount']);
        $this->assertSame(90.00, $result['total']);
    }

    public function test_fixed_discount_per_unit_multiplies_by_quantity(): void
    {
        $product = $this->createProduct(50);

        $this->createPromotion([
            'discount_type' => 'fixed',
            'discount_application' => 'per_unit',
            'discount_value' => 10,
        ]);

        $result = $this->calculate([
            ['product' => $product, 'quantity' => 3],
        ]);

        $this->assertSame(150.00, $result['subtotal']);
        $this->assertSame(30.00, $result['product_discount_amount']);
        $this->assertSame(120.00, $result['total']);
    }

    public function test_highest_fixed_per_order_override_applies_only_once(): void
    {
        $firstProduct = $this->createProduct(100);
        $secondProduct = $this->createProduct(100);

        $promotion = $this->createPromotion([
            'applies_to_all_products' => false,
            'discount_type' => null,
            'discount_value' => null,
        ]);

        $promotion->products()->attach([
            $firstProduct->id => [
                'discount_type' => 'fixed',
                'discount_application' => 'per_order',
                'discount_value' => 10,
            ],
            $secondProduct->id => [
                'discount_type' => 'fixed',
                'discount_application' => 'per_order',
                'discount_value' => 15,
            ],
        ]);

        $result = $this->calculate([
            ['product' => $firstProduct, 'quantity' => 1],
            ['product' => $secondProduct, 'quantity' => 1],
        ]);

        $this->assertSame(15.00, $result['product_discount_amount']);
        $this->assertSame(185.00, $result['total']);
    }

    public function test_combinable_promotions_can_apply_to_different_products(): void
    {
        $firstProduct = $this->createProduct(100);
        $secondProduct = $this->createProduct(100);

        $firstPromotion = $this->createPromotion([
            'name' => 'First combinable promotion',
            'applies_to_all_products' => false,
            'can_combine' => true,
            'discount_type' => null,
            'discount_value' => null,
        ]);

        $firstPromotion->products()->attach($firstProduct->id, [
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 10,
        ]);

        $secondPromotion = $this->createPromotion([
            'name' => 'Second combinable promotion',
            'applies_to_all_products' => false,
            'can_combine' => true,
            'discount_type' => null,
            'discount_value' => null,
        ]);

        $secondPromotion->products()->attach($secondProduct->id, [
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 20,
        ]);

        $result = $this->calculate([
            ['product' => $firstProduct, 'quantity' => 1],
            ['product' => $secondProduct, 'quantity' => 1],
        ]);

        $this->assertSame(30.00, $result['product_discount_amount']);
        $this->assertSame(170.00, $result['total']);
        $this->assertCount(2, $result['applied_promotions']);
    }

    public function test_non_combinable_promotions_do_not_stack(): void
    {
        $firstProduct = $this->createProduct(100);
        $secondProduct = $this->createProduct(100);

        $firstPromotion = $this->createPromotion([
            'name' => 'First standalone promotion',
            'applies_to_all_products' => false,
            'can_combine' => false,
            'discount_type' => null,
            'discount_value' => null,
        ]);

        $firstPromotion->products()->attach($firstProduct->id, [
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 10,
        ]);

        $secondPromotion = $this->createPromotion([
            'name' => 'Second standalone promotion',
            'applies_to_all_products' => false,
            'can_combine' => false,
            'discount_type' => null,
            'discount_value' => null,
        ]);

        $secondPromotion->products()->attach($secondProduct->id, [
            'discount_type' => 'percentage',
            'discount_application' => 'per_unit',
            'discount_value' => 20,
        ]);

        $result = $this->calculate([
            ['product' => $firstProduct, 'quantity' => 1],
            ['product' => $secondProduct, 'quantity' => 1],
        ]);

        // The better standalone promotion wins.
        $this->assertSame(20.00, $result['product_discount_amount']);
        $this->assertSame(180.00, $result['total']);
        $this->assertCount(1, $result['applied_promotions']);
    }

    public function test_free_delivery_applies_only_to_selected_delivery_zone(): void
    {
        $product = $this->createProduct(100);

        $eligibleZone = DeliveryZone::create([
            'name' => 'Eligible Test Zone ' . Str::random(6),
            'description' => 'Test delivery zone',
            'delivery_fee' => 25,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $otherZone = DeliveryZone::create([
            'name' => 'Other Test Zone ' . Str::random(6),
            'description' => 'Another test delivery zone',
            'delivery_fee' => 25,
            'is_active' => true,
            'sort_order' => 0,
        ]);

        $promotion = $this->createPromotion([
            'discount_type' => null,
            'discount_value' => null,
            'free_delivery' => true,
        ]);

        $promotion->deliveryZones()->attach($eligibleZone->id);

        $eligibleResult = $this->calculate([
            ['product' => $product, 'quantity' => 1],
        ], $eligibleZone);

        $otherResult = $this->calculate([
            ['product' => $product, 'quantity' => 1],
        ], $otherZone);

        $this->assertSame(25.00, $eligibleResult['delivery_discount_amount']);
        $this->assertSame(0.00, $eligibleResult['delivery_fee']);

        $this->assertSame(0.00, $otherResult['delivery_discount_amount']);
        $this->assertSame(25.00, $otherResult['delivery_fee']);
    }

    public function test_promotion_requires_minimum_order_value(): void
    {
        $product = $this->createProduct(50);

        $this->createPromotion([
            'discount_type' => 'percentage',
            'discount_value' => 20,
            'minimum_order_value' => 100,
        ]);

        $result = $this->calculate([
            ['product' => $product, 'quantity' => 1],
        ]);

        $this->assertSame(0.00, $result['product_discount_amount']);
        $this->assertSame(50.00, $result['total']);
        $this->assertCount(0, $result['applied_promotions']);
    }

    public function test_expired_promotion_is_not_applied(): void
    {
        $product = $this->createProduct(100);

        $this->createPromotion([
            'discount_type' => 'percentage',
            'discount_value' => 50,
            'starts_at' => now()->subDays(3),
            'ends_at' => now()->subDay(),
        ]);

        $result = $this->calculate([
            ['product' => $product, 'quantity' => 1],
        ]);

        $this->assertSame(0.00, $result['product_discount_amount']);
        $this->assertSame(100.00, $result['total']);
    }
}
