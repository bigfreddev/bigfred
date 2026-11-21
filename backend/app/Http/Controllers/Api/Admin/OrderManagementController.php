<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\DeliveryZone;
use App\Services\OrderPricingService;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;

class OrderManagementController extends Controller
{
    /**
     * List orders with search, filters and pagination.
     */
    public function index(Request $request)
    {
        $orders = Order::with('items')
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->search;

                $query->where(function ($q) use ($search) {
                    $q->where('order_number', 'like', "%{$search}%")
                        ->orWhere('customer_name', 'like', "%{$search}%")
                        ->orWhere('customer_phone', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('status'), fn ($q) =>
                $q->where('status', $request->status)
            )
            ->when($request->filled('source'), fn ($q) =>
                $q->where('source', $request->source)
            )
            ->latest()
            ->paginate(15);

        return response()->json($orders);
    }

    /**
     * Order dashboard statistics.
     */
    public function statistics()
    {
        return response()->json([
            'total_orders' => Order::count(),

            'awaiting_confirmation' => Order::where(
                'status', 'awaiting_confirmation'
            )->count(),

            'confirmed' => Order::where(
                'status', 'confirmed'
            )->count(),

            'processing' => Order::where(
                'status', 'processing'
            )->count(),

            'ready_for_delivery' => Order::where(
                'status', 'ready_for_delivery'
            )->count(),

            'out_for_delivery' => Order::where(
                'status', 'out_for_delivery'
            )->count(),

            'completed' => Order::where(
                'status', 'completed'
            )->count(),

            'cancelled' => Order::where(
                'status', 'cancelled'
            )->count(),

            'total_revenue' => Order::where(
                'status', 'completed'
            )->sum('total'),
        ]);
    }

    /**
     * View one order with its items and creator.
     */
    public function show(Order $order)
    {
        return response()->json([
            'order' => $order->load('items', 'creator'),
        ]);
    }

    /**
     * Create an order manually from the admin dashboard.
     *
     * Manual orders are automatically confirmed.
     * Stock is deducted immediately.
     */
    public function store(
        Request $request,
        OrderPricingService $pricingService
    ) {
        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email', 'max:255'],

            'delivery_address' => ['required', 'string', 'max:2000'],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'delivery_zone_id' => [
                'nullable',
                'integer',
                'exists:delivery_zones,id',
            ],

            'customer_notes' => ['nullable', 'string', 'max:2000'],
            'admin_notes' => ['nullable', 'string', 'max:2000'],

            'delivery_fee' => ['nullable', 'numeric', 'min:0'],

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
            $request,
            $pricingService
        ) {
            $products = collect($validated['items'])
                ->groupBy('product_id')
                ->map(fn ($items) => $items->sum('quantity'));

            $pricingItems = [];
            $stockUpdates = [];

            foreach ($products as $productId => $quantity) {
                $product = Product::whereKey($productId)
                    ->where('is_active', true)
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

                $stockUpdates[] = [
                    'product' => $product,
                    'quantity' => $quantity,
                ];
            }

            // Resolve and validate the selected delivery zone.
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
                            'The selected delivery area is unavailable.',
                        ],
                    ]);
                }
            }

            // An admin can supply a manually agreed delivery fee.
            $manualDeliveryFee = array_key_exists('delivery_fee', $validated)
                ? (float) $validated['delivery_fee']
                : null;

            // Other / unlisted areas require a manual quote
            // unless the administrator has already entered a fee.
            $deliveryQuotePending = (
                $deliveryZone === null &&
                $manualDeliveryFee === null
            );

            // Use exactly the same pricing engine as customer checkout.
            $pricing = $pricingService->calculate(
                $pricingItems,
                $deliveryZone,
                $manualDeliveryFee,
                $deliveryQuotePending
            );

            $order = Order::create([
                'order_number' => 'BF-'
                    . now()->format('Ymd')
                    . '-'
                    . Str::upper(Str::random(6)),

                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'],
                'customer_email' => $validated['customer_email'] ?? null,

                'delivery_address' => $validated['delivery_address'],
                'delivery_location' => $validated['delivery_location'] ?? null,

                'customer_notes' => $validated['customer_notes'] ?? null,
                'admin_notes' => $validated['admin_notes'] ?? null,

                'source' => 'manual',
                'status' => 'confirmed',

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

                'created_by' => $request->user()->id,
            ]);

            // Save discounted order-item snapshots.
            $order->items()->createMany($pricing['items']);

            // Preserve the promotions applied to this order.
            if (!empty($pricing['applied_promotions'])) {
                $order->appliedPromotions()->createMany(
                    $pricing['applied_promotions']
                );
            }

            // Manual orders are confirmed immediately, so deduct stock.
            foreach ($stockUpdates as $stockUpdate) {
                $affectedRows = Product::whereKey(
                    $stockUpdate['product']->id
                )
                    ->where('stock_quantity', '>=', $stockUpdate['quantity'])
                    ->decrement(
                        'stock_quantity',
                        $stockUpdate['quantity']
                    );

                if ($affectedRows !== 1) {
                    throw ValidationException::withMessages([
                        'items' => [
                            "Unable to deduct stock for {$stockUpdate['product']->name}.",
                        ],
                    ]);
                }
            }

            return $order->load([
                'items',
                'appliedPromotions',
            ]);
        });

        return response()->json([
            'message' => 'Manual order created successfully.',
            'order' => $order,
        ], 201);
    }

    /**
     * Update order status, delivery fee and admin notes.
     *
     * Inventory and payment status changes are atomic.
     */
    public function update(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => [
                'sometimes',
                'required',
                Rule::in([
                    'awaiting_confirmation',
                    'confirmed',
                    'processing',
                    'ready_for_delivery',
                    'out_for_delivery',
                    'completed',
                    'cancelled',
                ]),
            ],

            'cancellation_reason' => [
                'required_if:status,cancelled',
                'nullable',
                'string',
                'max:2000',
            ],

            'delivery_fee' => [
                'sometimes',
                'required',
                'numeric',
                'min:0',
            ],

            'admin_notes' => [
                'sometimes',
                'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $updatedOrder = DB::transaction(function () use ($validated, $order) {
            $lockedOrder = Order::whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            $oldStatus = $lockedOrder->status;
            $newStatus = $validated['status'] ?? $oldStatus;

            $allowedTransitions = [
                'awaiting_confirmation' => [
                    'confirmed',
                    'cancelled',
                ],
                'confirmed' => [
                    'processing',
                    'cancelled',
                ],
                'processing' => [
                    'ready_for_delivery',
                    'cancelled',
                ],
                'ready_for_delivery' => [
                    'out_for_delivery',
                    'cancelled',
                ],
                'out_for_delivery' => [
                    'completed',
                    'cancelled',
                ],
                'completed' => [],
                'cancelled' => [],
            ];

            if (
                $newStatus !== $oldStatus &&
                !in_array(
                    $newStatus,
                    $allowedTransitions[$oldStatus] ?? [],
                    true
                )
            ) {
                throw ValidationException::withMessages([
                    'status' => [
                        "Cannot change order status from {$oldStatus} to {$newStatus}.",
                    ],
                ]);
            }

            $lockedOrder->load('items');

            /*
             * CANCEL ORDER
             */
            if (
                $newStatus === 'cancelled' &&
                $oldStatus !== 'cancelled'
            ) {
                $lockedOrder->cancellation_reason =
                    $validated['cancellation_reason'];

                $lockedOrder->cancelled_at = now();

                if ($oldStatus === 'awaiting_confirmation') {
                    // Stock was never deducted.
                    $lockedOrder->restock_status = 'not_required';

                } elseif (in_array($oldStatus, [
                    'confirmed',
                    'processing',
                    'ready_for_delivery',
                ], true)) {
                    if ($lockedOrder->restock_status === 'restocked') {
                        throw ValidationException::withMessages([
                            'status' => [
                                'Stock has already been restored for this order.',
                            ],
                        ]);
                    }

                    $restoredItems = 0;

                    foreach ($lockedOrder->items as $item) {
                        if (!$item->product_id) {
                            continue;
                        }

                        // Lock the product row before restoring inventory.
                        $product = DB::table('products')
                            ->where('id', $item->product_id)
                            ->lockForUpdate()
                            ->first();

                        if (!$product) {
                            throw ValidationException::withMessages([
                                'status' => [
                                    "Product {$item->product_name} could not be found. Stock restoration failed.",
                                ],
                            ]);
                        }

                        $affectedRows = DB::table('products')
                            ->where('id', $item->product_id)
                            ->increment(
                                'stock_quantity',
                                (int) $item->quantity
                            );

                        if ($affectedRows !== 1) {
                            throw ValidationException::withMessages([
                                'status' => [
                                    "Unable to restore stock for {$item->product_name}.",
                                ],
                            ]);
                        }

                        $restoredItems++;
                    }

                    $lockedOrder->restock_status = $restoredItems > 0
                        ? 'restocked'
                        : 'not_restocked';

                } elseif ($oldStatus === 'out_for_delivery') {
                    // Wait until items are physically returned.
                    $lockedOrder->restock_status = 'restock_pending';
                }
            }

            /*
             * CONFIRM WEBSITE ORDER
             *
             * Stock is deducted only when an awaiting order is confirmed.
             */
            if (
                $oldStatus === 'awaiting_confirmation' &&
                $newStatus === 'confirmed'
            ) {
                foreach ($lockedOrder->items as $item) {
                    if (!$item->product_id) {
                        throw ValidationException::withMessages([
                            'status' => [
                                "The product for {$item->product_name} is no longer available.",
                            ],
                        ]);
                    }

                    $product = DB::table('products')
                        ->where('id', $item->product_id)
                        ->whereNull('deleted_at')
                        ->where('is_active', true)
                        ->lockForUpdate()
                        ->first();

                    if (
                        !$product ||
                        $product->stock_quantity < $item->quantity
                    ) {
                        throw ValidationException::withMessages([
                            'status' => [
                                "Insufficient stock or unavailable product: {$item->product_name}.",
                            ],
                        ]);
                    }

                    $affectedRows = DB::table('products')
                        ->where('id', $item->product_id)
                        ->where('stock_quantity', '>=', $item->quantity)
                        ->decrement(
                            'stock_quantity',
                            (int) $item->quantity
                        );

                    if ($affectedRows !== 1) {
                        throw ValidationException::withMessages([
                            'status' => [
                                "Unable to deduct stock for {$item->product_name}.",
                            ],
                        ]);
                    }
                }
            }

            /*
             * UPDATE DELIVERY FEE AND ORDER TOTAL
             */
            if (array_key_exists('delivery_fee', $validated)) {
                $lockedOrder->original_delivery_fee = round(
                    (float) $validated['delivery_fee'],
                    2
                );

                $lockedOrder->delivery_discount_amount = 0;
                $lockedOrder->delivery_fee = round(
                    (float) $validated['delivery_fee'],
                    2
                );

                $lockedOrder->delivery_quote_pending = false;

                $lockedOrder->total = round(
                    (float) $lockedOrder->subtotal -
                    (float) $lockedOrder->product_discount_amount +
                    (float) $lockedOrder->delivery_fee,
                    2
                );

                // Recalculate payment status from recorded transactions.
                $this->synchronizePaymentStatus($lockedOrder);
            }
            /*
             * UPDATE ADMIN NOTES
             */
            if (array_key_exists('admin_notes', $validated)) {
                $lockedOrder->admin_notes = $validated['admin_notes'];
            }

            $lockedOrder->status = $newStatus;
            $lockedOrder->save();

            return $lockedOrder->fresh()->load('items');
        });

        return response()->json([
            'message' => 'Order updated successfully.',
            'order' => $updatedOrder,
        ]);
    }

    /**
     * Recalculate payment status from payment and refund transactions.
     */
    private function synchronizePaymentStatus(Order $order): void
    {
        $grossPayments = (float) $order->payments()
            ->where('type', 'payment')
            ->sum('amount');

        $totalRefunds = (float) $order->payments()
            ->where('type', 'refund')
            ->sum('amount');

        $netPaid = round($grossPayments - $totalRefunds, 2);
        $orderTotal = round((float) $order->total, 2);

        if ($totalRefunds > 0 && $netPaid <= 0) {
            $paymentStatus = 'refunded';
        } elseif ($netPaid >= $orderTotal && $orderTotal > 0) {
            $paymentStatus = 'paid';
        } elseif ($netPaid > 0) {
            $paymentStatus = 'partially_paid';
        } else {
            $paymentStatus = 'unpaid';
        }

        $order->payment_status = $paymentStatus;
    }

    /**
     * Legacy payment endpoint.
     *
     * Payment status must now be calculated from recorded transactions.
     * This endpoint temporarily remains so existing frontend requests
     * receive a clear response while the frontend is being migrated.
     */
    public function updatePayment(Request $request, Order $order)
    {
        if ($request->has('payment_status')) {
            throw ValidationException::withMessages([
                'payment_status' => [
                    'Payment status can no longer be changed manually. Record a payment or refund transaction instead.',
                ],
            ]);
        }

        $validated = $request->validate([
            'payment_method' => [
                'nullable',
                'string',
                'max:100',
            ],
        ]);

        if (array_key_exists('payment_method', $validated)) {
            $order->payment_method = $validated['payment_method'];
            $order->save();
        }

        return response()->json([
            'message' => 'Payment method updated successfully.',
            'order' => $order->fresh(),
        ]);
    }
}
