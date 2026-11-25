<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReviewController extends Controller
{
    // Public: display approved customer reviews, optionally filtered by product.
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => 'nullable|integer|min:1',
            'product_name' => 'nullable|string|max:255',
        ]);

        $query = Review::query()
            ->where('status', 'approved');

        if (!empty($validated['product_id']) || !empty($validated['product_name'])) {
            $query->where(function ($builder) use ($validated) {
                if (!empty($validated['product_id'])) {
                    $builder->where('product_id', $validated['product_id']);
                }

                if (!empty($validated['product_name'])) {
                    if (!empty($validated['product_id'])) {
                        $builder->orWhere('product_name', $validated['product_name']);
                    } else {
                        $builder->where('product_name', $validated['product_name']);
                    }
                }
            });
        }

        $reviews = $query
            ->latest()
            ->paginate(12);

        return response()->json([
            'success' => true,
            'data' => $reviews,
        ]);
    }

    // Public: submit a customer review.
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_name' => 'required|string|max:80',
            'customer_email' => 'nullable|email|max:255',
            'product_id' => 'nullable|integer|min:1',
            'product_name' => 'required|string|max:255',
            'rating' => 'required|integer|between:1,5',
            'review_text' => 'required|string|min:5|max:1000',
        ]);

        $review = Review::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Your review has been submitted for approval.',
            'data' => $review,
        ], 201);
    }

    // Admin: view all reviews, with optional status filtering.
    public function adminIndex(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => [
                'nullable',
                Rule::in(['pending', 'approved', 'rejected']),
            ],
            'search' => 'nullable|string|max:100',
        ]);

        $query = Review::query();

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (!empty($validated['search'])) {
            $search = $validated['search'];

            $query->where(function ($builder) use ($search) {
                $builder->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('product_name', 'like', "%{$search}%")
                    ->orWhere('review_text', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->latest()->paginate(15),
        ]);
    }

    // Admin: review statistics.
    public function statistics(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total' => Review::count(),
                'pending' => Review::where('status', 'pending')->count(),
                'approved' => Review::where('status', 'approved')->count(),
                'rejected' => Review::where('status', 'rejected')->count(),
            ],
        ]);
    }

    // Admin: approve or reject a review.
    public function updateStatus(Request $request, Review $review): JsonResponse
    {
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in(['approved', 'rejected']),
            ],
        ]);

        $review->status = $validated['status'];
        $review->save();

        return response()->json([
            'success' => true,
            'message' => 'Review ' . $validated['status'] . ' successfully.',
            'data' => $review,
        ]);
    }
}
