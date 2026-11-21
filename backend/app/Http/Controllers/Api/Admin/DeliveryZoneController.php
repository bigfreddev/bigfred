<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DeliveryZoneController extends Controller
{
    /**
     * Public: list active delivery zones for customer checkout.
     */
    public function index(): JsonResponse
    {
        $zones = DeliveryZone::where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $zones,
        ]);
    }

    /**
     * Admin: list all delivery zones.
     */
    public function adminIndex(): JsonResponse
    {
        $zones = DeliveryZone::withCount([
            'promotions',
            'orders',
        ])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $zones,
        ]);
    }

    /**
     * Admin: create delivery zone.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:150',
                'unique:delivery_zones,name',
            ],
            'description' => ['nullable', 'string'],
            'delivery_fee' => ['required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
        ]);

        $zone = DeliveryZone::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Delivery zone created successfully.',
            'data' => $zone,
        ], 201);
    }

    /**
     * Admin: update delivery zone.
     */
    public function update(
        Request $request,
        DeliveryZone $deliveryZone
    ): JsonResponse {
        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:150',
                Rule::unique('delivery_zones', 'name')
                    ->ignore($deliveryZone->id),
            ],
            'description' => ['sometimes', 'nullable', 'string'],
            'delivery_fee' => ['sometimes', 'required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
        ]);

        $deliveryZone->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Delivery zone updated successfully.',
            'data' => $deliveryZone->fresh(),
        ]);
    }

    /**
     * Admin: delete delivery zone.
     *
     * Existing orders retain their delivery zone name and fee snapshots.
     * The database sets their delivery_zone_id to null.
     */
    public function destroy(DeliveryZone $deliveryZone): JsonResponse
    {
        $deliveryZone->delete();

        return response()->json([
            'success' => true,
            'message' => 'Delivery zone deleted successfully.',
        ]);
    }
}