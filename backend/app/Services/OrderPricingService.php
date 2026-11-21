<?php

namespace App\Services;

use App\Models\DeliveryZone;
use App\Models\Product;
use App\Models\Promotion;
use Illuminate\Support\Collection;

class OrderPricingService
{
    public function calculate(
        array $items,
        ?DeliveryZone $deliveryZone = null,
        ?float $manualDeliveryFee = null,
        bool $deliveryQuotePending = false,
        ?Promotion $previewPromotion = null
    ): array {
        $normalizedItems = [];
        $subtotal = 0.0;

        foreach ($items as $item) {
            /** @var Product $product */
            $product = $item['product'];
            $quantity = (int) $item['quantity'];

            $unitPrice = round((float) $product->price, 2);
            $lineSubtotal = round($unitPrice * $quantity, 2);

            $normalizedItems[] = [
                'product' => $product,
                'quantity' => $quantity,
                'original_unit_price' => $unitPrice,
                'subtotal' => $lineSubtotal,
            ];

            $subtotal += $lineSubtotal;
        }

        $subtotal = round($subtotal, 2);

        $originalDeliveryFee = $manualDeliveryFee !== null
            ? round(max(0, $manualDeliveryFee), 2)
            : ($deliveryZone
                ? round((float) $deliveryZone->delivery_fee, 2)
                : 0.0);

        $promotions = Promotion::query()
            ->with(['products', 'deliveryZones'])
            ->where('is_enabled', true)
            ->where(function ($query) {
                $query->whereNull('starts_at')
                    ->orWhere('starts_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('ends_at')
                    ->orWhere('ends_at', '>=', now());
            })
            ->get()
            ->filter(function (Promotion $promotion) use ($subtotal) {
                return $promotion->minimum_order_value === null
                    || $subtotal >= (float) $promotion->minimum_order_value;
            })
            ->values();

        if ($previewPromotion !== null) {
            $minimumValue = $previewPromotion->minimum_order_value;

            if ($minimumValue === null || $subtotal >= (float) $minimumValue) {
                $promotions->push($previewPromotion);
            }
        }

        $scenarios = collect();

        // Evaluate each non-combinable promotion independently.
        foreach ($promotions as $promotion) {
            if (!$promotion->can_combine) {
                $scenarios->push(collect([$promotion]));
            }
        }

        // Combinable promotions are evaluated together.
        $combinablePromotions = $promotions
            ->filter(fn (Promotion $promotion) => (bool) $promotion->can_combine)
            ->values();

        if ($combinablePromotions->isNotEmpty()) {
            $scenarios->push($combinablePromotions);
        }

        // Always include the no-promotion scenario.
        $scenarios->push(collect());

        $bestResult = null;
        $bestSaving = -1.0;

        foreach ($scenarios as $scenario) {
            $result = $this->evaluateScenario(
                $normalizedItems,
                $scenario,
                $deliveryZone,
                $originalDeliveryFee,
                $deliveryQuotePending
            );

            $saving = round(
                $result['product_discount_amount']
                + $result['delivery_discount_amount'],
                2
            );

            if ($saving > $bestSaving) {
                $bestSaving = $saving;
                $bestResult = $result;
            }
        }

        return $bestResult ?? $this->emptyResult(
            $normalizedItems,
            $subtotal,
            $originalDeliveryFee,
            $deliveryZone,
            $deliveryQuotePending
        );
    }

    private function evaluateScenario(
        array $items,
        Collection $promotions,
        ?DeliveryZone $deliveryZone,
        float $originalDeliveryFee,
        bool $deliveryQuotePending
    ): array {
        $itemDiscounts = [];
        $promotionContributions = [];
        $subtotal = 0.0;

        foreach ($items as $index => $item) {
            $subtotal += $item['subtotal'];

            $itemDiscounts[$index] = 0.0;
            $itemPromotionKeys[$index] = [];
        }

        /*
         * Product-level discounts.
         *
         * A product-specific pivot rule takes precedence over the
         * storewide rule for the same promotion.
         */
        foreach ($items as $index => $item) {
            $product = $item['product'];
            $quantity = $item['quantity'];
            $unitPrice = $item['original_unit_price'];

            $bestDiscount = 0.0;
            $bestPromotion = null;

            foreach ($promotions as $promotion) {
                $rule = $this->getProductRule($promotion, $product);

                if ($rule === null) {
                    continue;
                }

                if (
    $rule['discount_type'] === null
    || $rule['discount_value'] === null
    || (
        $rule['discount_type'] === 'fixed'
        && $rule['discount_application'] === 'per_order'
    )
) {
    continue;
}

                $discount = $this->calculateProductDiscount(
                    $unitPrice,
                    $quantity,
                    $rule['discount_type'],
                    $rule['discount_application'],
                    (float) $rule['discount_value']
                );

                if ($discount > $bestDiscount) {
                    $bestDiscount = $discount;
                    $bestPromotion = $promotion;
                }
            }

            $bestDiscount = round(
                min($item['subtotal'], $bestDiscount),
                2
            );

            $itemDiscounts[$index] = $bestDiscount;

            if ($bestPromotion !== null && $bestDiscount > 0) {
                $key = $this->promotionKey($bestPromotion);

                $itemPromotionKeys[$index][] = $key;

                $this->addContribution(
                    $promotionContributions,
                    $key,
                    $bestPromotion,
                    $bestDiscount,
                    0.0
                );
            }
        }

        /*
         * Fixed per-order discounts.
         *
         * A per-order amount is applied once, not multiplied by
         * quantity. The highest eligible fixed amount wins.
         */
        foreach ($promotions as $promotion) {
            $bestOrderRule = null;
            $eligibleSubtotal = 0.0;

            foreach ($items as $index => $item) {
                $rule = $this->getProductRule(
                    $promotion,
                    $item['product']
                );

                if (
                    $rule === null
                    || $rule['discount_type'] !== 'fixed'
                    || $rule['discount_application'] !== 'per_order'
                    || $rule['discount_value'] === null
                ) {
                    continue;
                }

                $eligibleSubtotal += max(
                    0,
                    $item['subtotal'] - $itemDiscounts[$index]
                );

                if (
                    $bestOrderRule === null
                    || (float) $rule['discount_value']
                        > (float) $bestOrderRule['discount_value']
                ) {
                    $bestOrderRule = $rule;
                }
            }

            if ($bestOrderRule === null || $eligibleSubtotal <= 0) {
                continue;
            }

            $orderDiscount = round(
                min(
                    $eligibleSubtotal,
                    (float) $bestOrderRule['discount_value']
                ),
                2
            );

            if ($orderDiscount <= 0) {
                continue;
            }

            // Allocate the order discount proportionally across eligible items.
            $remainingDiscount = $orderDiscount;
            $eligibleIndexes = [];

            foreach ($items as $index => $item) {
                $rule = $this->getProductRule(
                    $promotion,
                    $item['product']
                );

                if (
                    $rule !== null
                    && $rule['discount_type'] === 'fixed'
                    && $rule['discount_application'] === 'per_order'
                    && $rule['discount_value'] !== null
                ) {
                    $eligibleIndexes[] = $index;
                }
            }

            $key = $this->promotionKey($promotion);
            $allocated = 0.0;

            foreach ($eligibleIndexes as $position => $index) {
                $available = max(
                    0,
                    $items[$index]['subtotal'] - $itemDiscounts[$index]
                );

                if ($available <= 0) {
                    continue;
                }

                if ($position === count($eligibleIndexes) - 1) {
                    $share = min($available, $remainingDiscount);
                } else {
                    $share = round(
                        $orderDiscount * (
                            $available / $eligibleSubtotal
                        ),
                        2
                    );

                    $share = min($available, $share, $remainingDiscount);
                }

                $itemDiscounts[$index] = round(
                    $itemDiscounts[$index] + $share,
                    2
                );

                $remainingDiscount = round(
                    $remainingDiscount - $share,
                    2
                );

                $allocated += $share;
                $itemPromotionKeys[$index][] = $key;
            }

            if ($allocated > 0) {
                $this->addContribution(
                    $promotionContributions,
                    $key,
                    $promotion,
                    $allocated,
                    0.0
                );
            }
        }

        /*
         * Free delivery is awarded only when a listed delivery zone
         * is selected and the promotion includes that zone.
         */
        $deliveryDiscount = 0.0;
        $freeDeliveryPromotion = null;

        if (
            $deliveryZone !== null
            && !$deliveryQuotePending
            && $originalDeliveryFee > 0
        ) {
            foreach ($promotions as $promotion) {
                if (!$promotion->free_delivery) {
                    continue;
                }

                $eligibleZone = $promotion->deliveryZones
                    ->contains('id', $deliveryZone->id);

                if (!$eligibleZone) {
                    continue;
                }

                if (
                    $freeDeliveryPromotion === null
                    || $promotion->can_combine
                ) {
                    $freeDeliveryPromotion = $promotion;
                }

                if ($promotion->can_combine) {
                    break;
                }
            }

            if ($freeDeliveryPromotion !== null) {
                $deliveryDiscount = $originalDeliveryFee;

                $key = $this->promotionKey($freeDeliveryPromotion);

                $this->addContribution(
                    $promotionContributions,
                    $key,
                    $freeDeliveryPromotion,
                    0.0,
                    $deliveryDiscount
                );
            }
        }

        $productDiscount = round(array_sum($itemDiscounts), 2);

        $deliveryFee = round(
            max(0, $originalDeliveryFee - $deliveryDiscount),
            2
        );

        $total = round(
            max(0, $subtotal - $productDiscount + $deliveryFee),
            2
        );

        /*
         * Build order-item snapshots.
         *
         * unit_price is the effective discounted unit price.
         * original_unit_price is never modified.
         * discount_amount is the total discount for the line.
         */
        $orderItems = [];

        foreach ($items as $index => $item) {
            $quantity = $item['quantity'];
            $originalUnitPrice = $item['original_unit_price'];
            $lineDiscount = round($itemDiscounts[$index], 2);

            $lineTotal = round(
                max(0, $item['subtotal'] - $lineDiscount),
                2
            );

            $effectiveUnitPrice = $quantity > 0
                ? round($lineTotal / $quantity, 2)
                : $originalUnitPrice;

            $orderItems[] = [
                'product_id' => $item['product']->id,
                'product_name' => $item['product']->name,
                'product_sku' => $item['product']->sku,
                'original_unit_price' => $originalUnitPrice,
                'unit_price' => $effectiveUnitPrice,
                'discount_amount' => $lineDiscount,
                'quantity' => $quantity,
                'line_total' => $lineTotal,
            ];
        }

        /*
         * Only promotions that actually contributed a discount
         * are saved in the order history.
         */
        $appliedPromotions = [];

        foreach ($promotionContributions as $contribution) {
            $productAmount = round(
                $contribution['product_discount_amount'],
                2
            );

            $deliveryAmount = round(
                $contribution['delivery_discount_amount'],
                2
            );

            $totalAmount = round(
                $productAmount + $deliveryAmount,
                2
            );

            if ($totalAmount <= 0) {
                continue;
            }

            $appliedPromotions[] = [
                'promotion_id' => $contribution['promotion']->exists
                    ? $contribution['promotion']->id
                    : null,
                'promotion_name' => $contribution['promotion']->name,
                'product_discount_amount' => $productAmount,
                'delivery_discount_amount' => $deliveryAmount,
                'total_discount_amount' => $totalAmount,
            ];
        }

        $primaryPromotion = collect($appliedPromotions)->first();

        return [
            'items' => $orderItems,

            'subtotal' => round($subtotal, 2),
            'product_discount_amount' => $productDiscount,

            'original_delivery_fee' => $originalDeliveryFee,
            'delivery_discount_amount' => round($deliveryDiscount, 2),
            'delivery_fee' => $deliveryFee,

            'total' => $total,

            'promotion_id' => $primaryPromotion['promotion_id'] ?? null,
            'promotion_name' => $primaryPromotion['promotion_name'] ?? null,

            'applied_promotions' => $appliedPromotions,

            'delivery_zone_id' => $deliveryZone?->id,
            'delivery_zone_name' => $deliveryZone?->name,
            'delivery_quote_pending' => $deliveryQuotePending,
        ];
    }

    private function getProductRule(
        Promotion $promotion,
        Product $product
    ): ?array {
        $pivot = $promotion->products
            ->firstWhere('id', $product->id);

        if ($pivot !== null) {
            return [
                'discount_type' => $pivot->pivot->discount_type,
                'discount_application' => $pivot->pivot->discount_application
                    ?? $promotion->discount_application
                    ?? 'per_unit',
                'discount_value' => $pivot->pivot->discount_value,
            ];
        }

        if (!$promotion->applies_to_all_products) {
            return null;
        }

        return [
            'discount_type' => $promotion->discount_type,
            'discount_application' => $promotion->discount_application
                ?? 'per_unit',
            'discount_value' => $promotion->discount_value,
        ];
    }

    private function calculateProductDiscount(
        float $unitPrice,
        int $quantity,
        string $discountType,
        string $discountApplication,
        float $discountValue
    ): float {
        if ($unitPrice <= 0 || $quantity <= 0 || $discountValue <= 0) {
            return 0.0;
        }

        if ($discountApplication === 'per_order') {
            if ($discountType === 'percentage') {
                return round(
                    ($unitPrice * $quantity) * min(100, $discountValue) / 100,
                    2
                );
            }

            return round(
                min($unitPrice * $quantity, $discountValue),
                2
            );
        }

        if ($discountType === 'percentage') {
            $unitDiscount = $unitPrice
                * min(100, $discountValue)
                / 100;
        } elseif ($discountType === 'fixed') {
            $unitDiscount = min($unitPrice, $discountValue);
        } else {
            return 0.0;
        }

        return round(
            min($unitPrice, $unitDiscount) * $quantity,
            2
        );
    }

    private function promotionKey(Promotion $promotion): string
    {
        return $promotion->exists
            ? 'promotion_' . $promotion->id
            : 'preview_' . spl_object_id($promotion);
    }

    private function addContribution(
        array &$contributions,
        string $key,
        Promotion $promotion,
        float $productDiscount,
        float $deliveryDiscount
    ): void {
        if (!isset($contributions[$key])) {
            $contributions[$key] = [
                'promotion' => $promotion,
                'product_discount_amount' => 0.0,
                'delivery_discount_amount' => 0.0,
            ];
        }

        $contributions[$key]['product_discount_amount'] += $productDiscount;
        $contributions[$key]['delivery_discount_amount'] += $deliveryDiscount;
    }

    private function emptyResult(
        array $items,
        float $subtotal,
        float $deliveryFee,
        ?DeliveryZone $deliveryZone,
        bool $deliveryQuotePending
    ): array {
        $orderItems = [];

        foreach ($items as $item) {
            $product = $item['product'];
            $quantity = $item['quantity'];
            $unitPrice = $item['original_unit_price'];

            $orderItems[] = [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'product_sku' => $product->sku,
                'original_unit_price' => $unitPrice,
                'unit_price' => $unitPrice,
                'discount_amount' => 0,
                'quantity' => $quantity,
                'line_total' => round($unitPrice * $quantity, 2),
            ];
        }

        return [
            'items' => $orderItems,
            'subtotal' => round($subtotal, 2),
            'product_discount_amount' => 0,
            'original_delivery_fee' => round($deliveryFee, 2),
            'delivery_discount_amount' => 0,
            'delivery_fee' => round($deliveryFee, 2),
            'total' => round($subtotal + $deliveryFee, 2),
            'promotion_id' => null,
            'promotion_name' => null,
            'applied_promotions' => [],
            'delivery_zone_id' => $deliveryZone?->id,
            'delivery_zone_name' => $deliveryZone?->name,
            'delivery_quote_pending' => $deliveryQuotePending,
        ];
    }
}
