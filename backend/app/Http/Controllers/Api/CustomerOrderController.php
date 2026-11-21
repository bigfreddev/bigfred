<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

class CustomerOrderController extends Controller
{
    /**
     * Get the authenticated customer's orders.
     */
    public function index(Request $request)
    {
        $orders = $request->user()
            ->orders()
            ->with('items')
            ->latest()
            ->paginate(10);

        return response()->json([
            'success' => true,
            'message' => 'Customer orders retrieved successfully.',
            'data' => $orders,
        ]);
    }

    /**
     * Get details of one order belonging to the authenticated customer.
     */
    public function show(Request $request, int $order)
    {
        $customerOrder = $request->user()
            ->orders()
            ->with('items')
            ->whereKey($order)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'message' => 'Order details retrieved successfully.',
            'data' => $customerOrder,
        ]);
    }
}
