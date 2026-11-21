<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryZone;
use App\Models\Product;
use App\Models\Promotion;
use App\Services\OrderPricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PromotionController extends Controller
{
    /**
     * Admin: list promotions with optional status filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => [
                'sometimes',
                'nullable',
                Rule::in(['active', 'scheduled', 'expired', 'disabled']),
            ],
        ]);

        $query = Promotion::query()
            ->with([
                'products:id,name,sku,price',
                'deliveryZones:id,name,delivery_fee',
            ])
            ->withCount(['products', 'deliveryZones', 'orders'])
            ->latest();

        $status = $validated['status'] ?? null;
        $now = now();

        if ($status === 'disabled') {
            $query->where('is_enabled', false);
        } elseif ($status === 'scheduled') {
            $query->where('is_enabled', true)
                ->where('starts_at', '>', $now);
        } elseif ($status === 'expired') {
            $query->where('is_enabled', true)
                ->where('ends_at', '<', $now);
        } elseif ($status === 'active') {
            $query->where('is_enabled', true)
                ->where('starts_at', '<=', $now)
                ->where('ends_at', '>=', $now);
        }

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }

    /**
     * Admin: show one promotion.
     */
    public function show(Promotion $promotion): JsonResponse
    {
        $promotion->load([
            'products:id,name,sku,price,is_active',
            'deliveryZones:id,name,delivery_fee,is_active',
        ])->loadCount(['products', 'deliveryZones', 'orders']);

        return response()->json([
            'success' => true,
            'data' => $promotion,
            'status' => $promotion->status,
        ]);
    }

    /**
     * Admin: create a promotion.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePromotion($request);

        $promotion = DB::transaction(function () use ($validated) {
            $promotion = Promotion::create(
                $this->promotionAttributes($validated)
            );

            $this->syncProducts($promotion, $validated);
            $this->syncDeliveryZones($promotion, $validated);

            return $promotion;
        });

        $promotion->load(['products', 'deliveryZones']);

        return response()->json([
            'success' => true,
            'message' => 'Promotion created successfully.',
            'data' => $promotion,
            'status' => $promotion->status,
        ], 201);
    }

    /**
     * Admin: update a promotion.
     */
    public function update(
        Request $request,
        Promotion $promotion
    ): JsonResponse {
        $validated = $this->validatePromotion($request, $promotion);

        DB::transaction(function () use ($promotion, $validated) {
            $promotion->update(
                $this->promotionAttributes($validated)
            );

            if (array_key_exists('products', $validated)) {
                $this->syncProducts($promotion, $validated);
            }

            if (array_key_exists('delivery_zone_ids', $validated)) {
                $this->syncDeliveryZones($promotion, $validated);
            }
        });

        $promotion = $promotion->fresh()
            ->load(['products', 'deliveryZones']);

        return response()->json([
            'success' => true,
            'message' => 'Promotion updated successfully.',
            'data' => $promotion,
            'status' => $promotion->status,
        ]);
    }

    /**
     * Admin: manually enable or disable a promotion.
     */
    public function updateStatus(
        Request $request,
        Promotion $promotion
    ): JsonResponse {
        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
        ]);

        $promotion->update([
            'is_enabled' => $validated['is_enabled'],
        ]);

        $promotion = $promotion->fresh();

        return response()->json([
            'success' => true,
            'message' => $promotion->is_enabled
                ? 'Promotion enabled successfully.'
                : 'Promotion disabled successfully.',
            'data' => $promotion,
            'status' => $promotion->status,
        ]);
    }

    /**
     * Admin: delete a promotion.
     *
     * Existing order promotion history is preserved by nullOnDelete.
     */
    public function destroy(Promotion $promotion): JsonResponse
    {
        $promotion->delete();

        return response()->json([
            'success' => true,
            'message' => 'Promotion deleted successfully.',
        ]);
    }

    /**
     * Preview the effect of currently configured active promotions.
     *
     * This uses the same pricing service as checkout.
     * It does not create or modify database records.
     *
     * Note: this does not preview an unsaved promotion.
     */
    public function preview(
        Request $request,
        OrderPricingService $pricingService
    ): JsonResponse {
        /*
         * Existing preview requests only provide order items and a
         * delivery zone. Draft requests additionally provide the same
         * promotion fields used by the create endpoint.
         */
        $hasDraftPromotion = $request->has('name');

        $validatedPromotion = $hasDraftPromotion
            ? $this->validatePromotion($request)
            : [];

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => [
                'required',
                'integer',
                'distinct',
                'exists:products,id',
            ],
            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:1000',
            ],
            'delivery_zone_id' => [
                'nullable',
                'integer',
                'exists:delivery_zones,id',
            ],
        ]);

        $items = [];

        foreach ($validated['items'] as $item) {
            $product = Product::query()
                ->where('is_active', true)
                ->find($item['product_id']);

            if (!$product) {
                throw ValidationException::withMessages([
                    'items' => [
                        'One or more selected products are inactive or unavailable.',
                    ],
                ]);
            }

            $items[] = [
                'product' => $product,
                'quantity' => $item['quantity'],
            ];
        }

        $deliveryZone = null;

        if (!empty($validated['delivery_zone_id'])) {
            $deliveryZone = DeliveryZone::query()
                ->where('is_active', true)
                ->find($validated['delivery_zone_id']);

            if (!$deliveryZone) {
                throw ValidationException::withMessages([
                    'delivery_zone_id' => [
                        'The selected delivery zone is inactive or unavailable.',
                    ],
                ]);
            }
        }

        $previewPromotion = null;

        if ($hasDraftPromotion) {
            $previewPromotion = new Promotion(
                $this->promotionAttributes($validatedPromotion)
            );

            $draftProducts = collect();

            foreach ($validatedPromotion['products'] ?? [] as $productRule) {
                $product = Product::query()
                    ->where('is_active', true)
                    ->find($productRule['product_id']);

                if (!$product) {
                    throw ValidationException::withMessages([
                        'products' => [
                            'One or more selected promotion products are inactive or unavailable.',
                        ],
                    ]);
                }

                $product->setRelation('pivot', new Pivot([
                    'discount_type' => $productRule['discount_type'] ?? null,
                    'discount_application' => $productRule['discount_application']
                        ?? 'per_unit',
                    'discount_value' => $productRule['discount_value'] ?? null,
                ]));

                $draftProducts->push($product);
            }

            $draftZoneIds = $validatedPromotion['delivery_zone_ids'] ?? [];

            $draftZones = DeliveryZone::query()
                ->where('is_active', true)
                ->whereIn('id', $draftZoneIds)
                ->get();

            $previewPromotion->setRelation('products', $draftProducts);
            $previewPromotion->setRelation('deliveryZones', $draftZones);
        }

        $result = $pricingService->calculate(
            $items,
            $deliveryZone,
            null,
            false,
            $previewPromotion
        );

        return response()->json([
            'success' => true,
            'preview_mode' => $hasDraftPromotion ? 'draft' : 'active_promotions',
            'data' => $result,
        ]);
    }
    /**
     * Validate promotion data for both creation and partial updates.
     */
    private function validatePromotion(
        Request $request,
        ?Promotion $promotion = null
    ): array {
        $isUpdate = $promotion !== null;

        $validated = $request->validate([
            'name' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:200',
            ],
            'description' => ['sometimes', 'nullable', 'string'],

            'discount_type' => [
                'sometimes',
                'nullable',
                Rule::in(['percentage', 'fixed']),
            ],
            'discount_application' => [
                'sometimes',
                Rule::in(['per_unit', 'per_order']),
            ],
            'discount_value' => [
                'sometimes',
                'nullable',
                'numeric',
                'gt:0',
            ],

            'applies_to_all_products' => ['sometimes', 'boolean'],
            'free_delivery' => ['sometimes', 'boolean'],
            'can_combine' => ['sometimes', 'boolean'],

            'minimum_order_value' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0',
            ],

            'starts_at' => [
                $isUpdate ? 'sometimes' : 'required',
                'date',
            ],
            'ends_at' => [
                $isUpdate ? 'sometimes' : 'required',
                'date',
            ],

            'is_enabled' => ['sometimes', 'boolean'],

            'products' => ['sometimes', 'array'],
            'products.*.product_id' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('products', 'id')
                    ->where('is_active', true)
                    ->whereNull('deleted_at'),
            ],
            'products.*.discount_type' => [
                'sometimes',
                'nullable',
                Rule::in(['percentage', 'fixed']),
            ],
            'products.*.discount_application' => [
                'sometimes',
                Rule::in(['per_unit', 'per_order']),
            ],
            'products.*.discount_value' => [
                'sometimes',
                'nullable',
                'numeric',
                'gt:0',
            ],

            'delivery_zone_ids' => ['sometimes', 'array'],
            'delivery_zone_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('delivery_zones', 'id')
                    ->where('is_active', true),
            ],
        ]);

        $current = $promotion?->toArray() ?? [];

        // Resolve effective values after combining existing and submitted data.
        $discountType = array_key_exists('discount_type', $validated)
            ? $validated['discount_type']
            : ($current['discount_type'] ?? null);

        $discountValue = array_key_exists('discount_value', $validated)
            ? $validated['discount_value']
            : ($current['discount_value'] ?? null);

        $discountApplication = $validated['discount_application']
            ?? $current['discount_application']
            ?? 'per_unit';

        $appliesToAll = $validated['applies_to_all_products']
            ?? $current['applies_to_all_products']
            ?? true;

        $freeDelivery = $validated['free_delivery']
            ?? $current['free_delivery']
            ?? false;

        $hasProductRules = array_key_exists('products', $validated)
            ? count($validated['products']) > 0
            : ($promotion ? $promotion->products()->exists() : false);

        $hasDeliveryZones = array_key_exists('delivery_zone_ids', $validated)
            ? count($validated['delivery_zone_ids']) > 0
            : ($promotion ? $promotion->deliveryZones()->exists() : false);

        // A promotion must provide either a discount or free delivery.
        if (!$discountType && !$freeDelivery && !$hasProductRules) {
            throw ValidationException::withMessages([
                'discount_type' => [
                    'Provide a percentage or fixed discount, or enable free delivery.',
                ],
            ]);
        }

        // Validate the global discount configuration.
        if ($discountType && $discountValue === null && !$hasProductRules) {
            throw ValidationException::withMessages([
                'discount_value' => [
                    'A discount value is required when a discount type is selected.',
                ],
            ]);
        }

        if (
            $discountType === 'percentage'
            && $discountValue !== null
            && (float) $discountValue > 100
        ) {
            throw ValidationException::withMessages([
                'discount_value' => [
                    'A percentage discount cannot exceed 100%.',
                ],
            ]);
        }

        if ($discountType === 'fixed' && !in_array(
            $discountApplication,
            ['per_unit', 'per_order'],
            true
        )) {
            throw ValidationException::withMessages([
                'discount_application' => [
                    'Choose per_unit or per_order for a fixed discount.',
                ],
            ]);
        }

        if (!$appliesToAll && !$hasProductRules) {
            throw ValidationException::withMessages([
                'products' => [
                    'Select at least one product when the promotion is not storewide.',
                ],
            ]);
        }

        // Validate each product's effective discount configuration.
        foreach ($validated['products'] ?? [] as $index => $productRule) {
            $type = array_key_exists('discount_type', $productRule)
                ? $productRule['discount_type']
                : $discountType;

            $value = array_key_exists('discount_value', $productRule)
                ? $productRule['discount_value']
                : $discountValue;

            $application = $productRule['discount_application']
                ?? $discountApplication;

            if (!$type || $value === null) {
                if (!$freeDelivery) {
                    throw ValidationException::withMessages([
                        "products.{$index}.discount_value" => [
                            'A discount type and value are required for this product.',
                        ],
                    ]);
                }

                continue;
            }

            if ($type === 'percentage' && (float) $value > 100) {
                throw ValidationException::withMessages([
                    "products.{$index}.discount_value" => [
                        'A percentage discount cannot exceed 100%.',
                    ],
                ]);
            }

            if ($type === 'fixed' && !in_array(
                $application,
                ['per_unit', 'per_order'],
                true
            )) {
                throw ValidationException::withMessages([
                    "products.{$index}.discount_application" => [
                        'Choose per_unit or per_order for a fixed discount.',
                    ],
                ]);
            }
        }

        // Free delivery must be linked to at least one active delivery zone.
        if ($freeDelivery && !$hasDeliveryZones) {
            throw ValidationException::withMessages([
                'delivery_zone_ids' => [
                    'Select at least one delivery zone for a free-delivery promotion.',
                ],
            ]);
        }

        // Compare effective dates so partial updates work correctly.
        $effectiveStart = $validated['starts_at']
            ?? $current['starts_at']
            ?? null;

        $effectiveEnd = $validated['ends_at']
            ?? $current['ends_at']
            ?? null;

        if ($effectiveStart && $effectiveEnd) {
            if (
                !Carbon::parse($effectiveEnd)->greaterThan(
                    Carbon::parse($effectiveStart)
                )
            ) {
                throw ValidationException::withMessages([
                    'ends_at' => [
                        'The end date must be later than the start date.',
                    ],
                ]);
            }
        }

        return $validated;
    }

    /**
     * Build promotion attributes without overwriting omitted fields.
     */
    private function promotionAttributes(array $validated): array
    {
        $fields = [
            'name',
            'description',
            'discount_type',
            'discount_application',
            'discount_value',
            'applies_to_all_products',
            'free_delivery',
            'can_combine',
            'minimum_order_value',
            'starts_at',
            'ends_at',
            'is_enabled',
        ];

        return array_intersect_key(
            $validated,
            array_flip($fields)
        );
    }

    /**
     * Synchronize selected products and their optional discount overrides.
     */
    private function syncProducts(
        Promotion $promotion,
        array $validated
    ): void {
        if (!array_key_exists('products', $validated)) {
            return;
        }

        $syncData = [];

        foreach ($validated['products'] as $product) {
            $syncData[$product['product_id']] = [
                'discount_type' => $product['discount_type'] ?? null,
                'discount_application' => $product['discount_application']
                    ?? 'per_unit',
                'discount_value' => $product['discount_value'] ?? null,
            ];
        }

        $promotion->products()->sync($syncData);
    }

    /**
     * Synchronize delivery zones eligible for free delivery.
     */
    private function syncDeliveryZones(
        Promotion $promotion,
        array $validated
    ): void {
        if (!array_key_exists('delivery_zone_ids', $validated)) {
            return;
        }

        $promotion->deliveryZones()->sync(
            $validated['delivery_zone_ids']
        );
    }
}
