<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryZone;
use App\Models\Order;
use App\Models\Product;
use App\Services\OrderPricingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function store(
        Request $request,
        OrderPricingService $pricingService
    ) {
        $customer = $request->user();

        $validated = $request->validate([
            'customer_phone' => ['required', 'string', 'max:30'],
            'delivery_address' => ['required', 'string', 'max:2000'],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'delivery_zone_id' => [
                'nullable',
                'integer',
                'exists:delivery_zones,id',
            ],
            'customer_notes' => ['nullable', 'string', 'max:2000'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => [
                'required',
                'integer',
                'exists:products,id',
            ],
            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:100',
            ],
        ]);

        $order = DB::transaction(function () use (
            $validated,
            $customer,
            $pricingService
        ) {
            $products = collect($validated['items'])
                ->groupBy('product_id')
                ->map(fn ($items) => $items->sum('quantity'));

            $pricingItems = [];

            /*
             * Lock products while checking availability and stock.
             * Website orders do not deduct stock until confirmed.
             */
            foreach ($products as $productId => $quantity) {
                $product = Product::whereKey($productId)
                    ->where('is_active', true)
                    ->whereNull('deleted_at')
                    ->lockForUpdate()
                    ->first();

                if (!$product) {
                    throw ValidationException::withMessages([
                        'items' => [
                            "Product ID {$productId} is unavailable.",
                        ],
                    ]);
                }

                if ($product->stock_quantity < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => [
                            "Insufficient stock for {$product->name}.",
                        ],
                    ]);
                }

                $pricingItems[] = [
                    'product' => $product,
                    'quantity' => $quantity,
                ];
            }

            /*
             * Resolve the delivery zone on the server.
             * Customers cannot use inactive delivery zones.
             */
            $deliveryZone = null;

            if (!empty($validated['delivery_zone_id'])) {
                $deliveryZone = DeliveryZone::query()
                    ->whereKey($validated['delivery_zone_id'])
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->first();

                if (!$deliveryZone) {
                    throw ValidationException::withMessages([
                        'delivery_zone_id' => [
                            'The selected delivery area is unavailable. Please select another area.',
                        ],
                    ]);
                }
            }

            /*
             * No selected zone means Other / Outside listed areas.
             * Delivery must be quoted manually by the admin.
             */
            $deliveryQuotePending = $deliveryZone === null;

            /*
             * Calculate all product discounts, delivery charges
             * and promotion eligibility centrally.
             */
            $pricing = $pricingService->calculate(
                $pricingItems,
                $deliveryZone,
                null,
                $deliveryQuotePending
            );

            $order = Order::create([
                'user_id' => $customer->id,

                'order_number' => 'BF-'
                    . now()->format('Ymd')
                    . '-'
                    . Str::upper(Str::random(6)),

                'customer_name' => $customer->name,
                'customer_email' => $customer->email,

                'customer_phone' => $validated['customer_phone'],
                'delivery_address' => $validated['delivery_address'],
                'delivery_location' => $validated['delivery_location'] ?? null,
                'customer_notes' => $validated['customer_notes'] ?? null,

                'source' => 'website',
                'status' => 'awaiting_confirmation',

                'subtotal' => $pricing['subtotal'],
                'product_discount_amount' => $pricing['product_discount_amount'],

                'original_delivery_fee' => $pricing['original_delivery_fee'],
                'delivery_discount_amount' => $pricing['delivery_discount_amount'],
                'delivery_fee' => $pricing['delivery_fee'],

                'total' => $pricing['total'],

                'promotion_id' => $pricing['promotion_id'],
                'promotion_name' => $pricing['promotion_name'],

                'delivery_zone_id' => $pricing['delivery_zone_id'],
                'delivery_zone_name' => $pricing['delivery_zone_name'],
                'delivery_quote_pending' => $pricing['delivery_quote_pending'],

                'payment_status' => 'unpaid',
            ]);

            /*
             * Save the original product prices and the discounted
             * line totals as an order-time snapshot.
             */
            $order->items()->createMany($pricing['items']);

            /*
             * Save every promotion that contributed a discount.
             * This preserves the promotion history even after
             * the promotion expires or is deleted.
             */
            if (!empty($pricing['applied_promotions'])) {
                $order->appliedPromotions()->createMany(
                    $pricing['applied_promotions']
                );
            }

            return $order->load([
                'items',
                'appliedPromotions',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Your order has been created successfully.',
            'order' => $order,
        ], 201);
    }
}
