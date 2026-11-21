<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderManagementTest extends TestCase
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
        $categoryId = DB::table('categories')->insertGetId([
            'name' => 'Test Category ' . Str::lower(Str::random(8)),
            'slug' => 'test-category-' . Str::lower(Str::random(8)),
            'is_active' => true,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Product::create([
            'category_id' => $categoryId,
            'name' => 'Test Body Oil',
            'slug' => 'test-body-oil-' . Str::lower(Str::random(6)),
            'sku' => 'BF-' . Str::upper(Str::random(8)),
            'price' => 50.00,
            'stock_quantity' => $stock,
            'low_stock_threshold' => 2,
            'is_active' => true,
        ]);
    }

    private function createOrder(
        Product $product,
        string $status = 'awaiting_confirmation',
        int $quantity = 2,
        float $total = 100.00
    ): Order {
        $order = Order::create([
            'order_number' => 'BF-TEST-' . Str::upper(Str::random(8)),
            'customer_name' => 'Test Customer',
            'customer_phone' => '0240000000',
            'delivery_address' => 'Accra, Ghana',
            'source' => 'website',
            'status' => $status,
            'subtotal' => $total,
            'delivery_fee' => 0,
            'total' => $total,
            'payment_status' => 'unpaid',
        ]);

        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'product_sku' => $product->sku,
            'unit_price' => 50.00,
            'quantity' => $quantity,
            'line_total' => 50.00 * $quantity,
        ]);

        return $order;
    }

    public function test_confirming_website_order_deducts_stock(): void
    {
        $product = $this->createProduct(10);
        $order = $this->createOrder($product);

        $response = $this->patchJson(
            "/api/admin/orders/{$order->id}",
            ['status' => 'confirmed']
        );

        $response->assertOk();

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'confirmed',
        ]);

        $this->assertSame(
            8,
            $product->fresh()->stock_quantity
        );
    }

    public function test_order_cannot_be_confirmed_when_stock_is_insufficient(): void
    {
        $product = $this->createProduct(1);
        $order = $this->createOrder($product);

        $response = $this->patchJson(
            "/api/admin/orders/{$order->id}",
            ['status' => 'confirmed']
        );

        $response->assertUnprocessable();

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'awaiting_confirmation',
        ]);

        $this->assertSame(
            1,
            $product->fresh()->stock_quantity
        );
    }

    public function test_cancelling_confirmed_order_restores_stock_only_once(): void
    {
        $product = $this->createProduct(8);

        $order = $this->createOrder(
            $product,
            'confirmed',
            2
        );

        $firstResponse = $this->patchJson(
            "/api/admin/orders/{$order->id}",
            [
                'status' => 'cancelled',
                'cancellation_reason' => 'Customer requested cancellation.',
            ]
        );

        $firstResponse->assertOk();

        $this->assertSame(
            10,
            $product->fresh()->stock_quantity
        );

        $secondResponse = $this->patchJson(
            "/api/admin/orders/{$order->id}",
            [
                'status' => 'cancelled',
                'cancellation_reason' => 'Customer requested cancellation.',
            ]
        );

        $secondResponse->assertOk();

        $this->assertSame(
            10,
            $product->fresh()->stock_quantity
        );

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'cancelled',
            'restock_status' => 'restocked',
        ]);
    }

    public function test_completed_order_cannot_be_cancelled(): void
    {
        $product = $this->createProduct(8);

        $order = $this->createOrder(
            $product,
            'completed',
            2
        );

        $response = $this->patchJson(
            "/api/admin/orders/{$order->id}",
            [
                'status' => 'cancelled',
                'cancellation_reason' => 'Attempted cancellation.',
            ]
        );

        $response->assertUnprocessable();

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'completed',
        ]);

        $this->assertSame(
            8,
            $product->fresh()->stock_quantity
        );
    }

    public function test_payment_cannot_exceed_outstanding_order_balance(): void
    {
        $product = $this->createProduct();

        $order = $this->createOrder(
            $product,
            'confirmed',
            2,
            100.00
        );

        $response = $this->postJson(
            "/api/admin/orders/{$order->id}/payments",
            [
                'type' => 'payment',
                'amount' => 101.00,
                'payment_method' => 'cash',
            ]
        );

        $response->assertUnprocessable();

        $this->assertDatabaseMissing('order_payments', [
            'order_id' => $order->id,
            'type' => 'payment',
        ]);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'payment_status' => 'unpaid',
        ]);
    }

    public function test_refund_cannot_exceed_net_amount_paid(): void
    {
        $product = $this->createProduct();

        $order = $this->createOrder(
            $product,
            'confirmed',
            2,
            100.00
        );

        $payment = OrderPayment::create([
            'order_id' => $order->id,
            'type' => 'payment',
            'amount' => 40.00,
            'payment_method' => 'cash',
            'transaction_date' => now(),
            'recorded_by' => $this->admin->id,
        ]);

        try {
            $order->update([
                'payment_status' => 'partially_paid',
            ]);

            $response = $this->postJson(
                "/api/admin/orders/{$order->id}/payments",
                [
                    'type' => 'refund',
                    'amount' => 41.00,
                    'payment_method' => 'cash',
                ]
            );

            $response->assertUnprocessable();

            $this->assertDatabaseHas('order_payments', [
                'order_id' => $order->id,
                'type' => 'payment',
                'amount' => '40.00',
            ]);

            $this->assertDatabaseMissing('order_payments', [
                'order_id' => $order->id,
                'type' => 'refund',
            ]);

            $this->assertDatabaseHas('orders', [
                'id' => $order->id,
                'payment_status' => 'partially_paid',
            ]);
        } finally {
            DB::table('order_payments')
                ->where('id', $payment->id)
                ->delete();
        }
    }
}
