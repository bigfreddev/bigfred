<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    // Public: list active products.
    public function index(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'images'])->withCount('approvedReviews')->withAvg('approvedReviews', 'rating')
            ->where('is_active', true)
            ->whereHas('category', function ($q) {
                $q->where('is_active', true);
            });

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }

        $sort = $request->input('sort', 'newest');

        match ($sort) {
            'price_low' => $query->orderBy('price', 'asc'),
            'price_high' => $query->orderBy('price', 'desc'),
            'name' => $query->orderBy('name', 'asc'),
            'oldest' => $query->oldest(),
            default => $query->latest(),
        };

        $products = $query->paginate(12);

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    // Public: view one active product by slug.
    public function show(string $slug): JsonResponse
    {
        $product = Product::with(['category', 'images'])->withCount('approvedReviews')->withAvg('approvedReviews', 'rating')
            ->where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $product,
        ]);
    }

    // Admin: list all products, including inactive products.
    public function adminIndex(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'images']);

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('status')) {
            $query->where('is_active', $request->status === 'active');
        }

        if ($request->filled('stock')) {
            if ($request->stock === 'out') {
                $query->where('stock_quantity', 0);
            } elseif ($request->stock === 'low') {
                $query->whereColumn(
                    'stock_quantity',
                    '<=',
                    'low_stock_threshold'
                )->where('stock_quantity', '>', 0);
            } elseif ($request->stock === 'in') {
                $query->where('stock_quantity', '>', 0);
            }
        }

        $products = $query->latest()->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    // Admin: create a product.
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'name' => 'required|string|max:150',
            'sku' => 'nullable|string|max:100|unique:products,sku',
            'short_description' => 'nullable|string|max:500',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'compare_at_price' => 'nullable|numeric|min:0|gt:price',
            'stock_quantity' => 'sometimes|integer|min:0',
            'low_stock_threshold' => 'sometimes|integer|min:0',
            'is_featured' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'images' => 'sometimes|array|max:10',
            'images.*' => 'image|mimes:jpg,jpeg,png,webp|max:5120',
            'primary_image_index' => 'nullable|integer|min:0',
        ]);

        $slug = $this->generateUniqueSlug($validated['name']);

        $sku = $validated['sku'] ?? $this->generateUniqueSku();

        $imageFiles = $request->file('images', []);
        $primaryIndex = $request->input('primary_image_index', 0);

        if (!empty($imageFiles) && $primaryIndex >= count($imageFiles)) {
            return response()->json([
                'success' => false,
                'message' => 'The selected primary image does not exist.',
            ], 422);
        }

        $storedPaths = [];

        try {
            $product = DB::transaction(function () use (
                $validated,
                $slug,
                $sku,
                $imageFiles,
                $primaryIndex,
                &$storedPaths
            ) {
                $product = Product::create([
                    'category_id' => $validated['category_id'],
                    'name' => $validated['name'],
                    'slug' => $slug,
                    'sku' => $sku,
                    'short_description' => $validated['short_description'] ?? null,
                    'description' => $validated['description'] ?? null,
                    'price' => $validated['price'],
                    'compare_at_price' => $validated['compare_at_price'] ?? null,
                    'stock_quantity' => $validated['stock_quantity'] ?? 0,
                    'low_stock_threshold' => $validated['low_stock_threshold'] ?? 5,
                    'is_featured' => $validated['is_featured'] ?? false,
                    'is_active' => $validated['is_active'] ?? true,
                ]);

                foreach ($imageFiles as $index => $image) {
                    $path = $image->store('products', 'public');
                    $storedPaths[] = $path;

                    $product->images()->create([
                        'image_path' => $path,
                        'alt_text' => $product->name,
                        'is_primary' => (int) $index === (int) $primaryIndex,
                        'sort_order' => $index,
                    ]);
                }

                return $product;
            });
        } catch (\Throwable $exception) {
            foreach ($storedPaths as $path) {
                Storage::disk('public')->delete($path);
            }

            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully.',
            'data' => $product->load(['category', 'images']),
        ], 201);
    }

    // Admin: update a product.
    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => 'sometimes|required|exists:categories,id',
            'name' => 'sometimes|required|string|max:150',
            'sku' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('products', 'sku')->ignore($product->id),
            ],
            'short_description' => 'nullable|string|max:500',
            'description' => 'nullable|string',
            'price' => 'sometimes|required|numeric|min:0',
            'compare_at_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'sometimes|integer|min:0',
            'low_stock_threshold' => 'sometimes|integer|min:0',
            'is_featured' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'images' => 'sometimes|array|max:10',
            'images.*' => 'image|mimes:jpg,jpeg,png,webp|max:5120',
            'primary_image_index' => 'nullable|integer|min:0',
        ]);

        $imageFiles = $request->file('images', []);
        $primaryIndex = $request->input('primary_image_index');

        if (
            !empty($imageFiles) &&
            $primaryIndex !== null &&
            $primaryIndex >= count($imageFiles)
        ) {
            return response()->json([
                'success' => false,
                'message' => 'The selected primary image does not exist.',
            ], 422);
        }

        $storedPaths = [];

        try {
            DB::transaction(function () use (
                $validated,
                $product,
                $imageFiles,
                $primaryIndex,
                &$storedPaths
            ) {
                $updates = collect($validated)->except([
                    'images',
                    'primary_image_index',
                ])->all();

                if (isset($updates['name'])) {
                    $updates['slug'] = $this->generateUniqueSlug(
                        $updates['name'],
                        $product->id
                    );
                }

                $product->update($updates);

                foreach ($imageFiles as $index => $image) {
                    $path = $image->store('products', 'public');
                    $storedPaths[] = $path;

                    $makePrimary = $primaryIndex !== null
                        ? (int) $index === (int) $primaryIndex
                        : (!$product->images()->where('is_primary', true)->exists()
                            && $index === 0);

                    if ($makePrimary) {
                        $product->images()->update(['is_primary' => false]);
                    }

                    $product->images()->create([
                        'image_path' => $path,
                        'alt_text' => $product->name,
                        'is_primary' => $makePrimary,
                        'sort_order' => $product->images()->count(),
                    ]);
                }
            });
        } catch (\Throwable $exception) {
            foreach ($storedPaths as $path) {
                Storage::disk('public')->delete($path);
            }

            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully.',
            'data' => $product->fresh()->load(['category', 'images']),
        ]);
    }

    // Admin: choose an existing image as the primary image.
    public function setPrimaryImage(
        Product $product,
        ProductImage $image
    ): JsonResponse {
        if ($image->product_id !== $product->id) {
            return response()->json([
                'success' => false,
                'message' => 'This image does not belong to the selected product.',
            ], 422);
        }

        DB::transaction(function () use ($product, $image) {
            $product->images()->update(['is_primary' => false]);
            $image->update(['is_primary' => true]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Primary image updated successfully.',
            'data' => $product->fresh()->load('images'),
        ]);
    }

    // Admin: remove one product image.
    public function deleteImage(
        Product $product,
        ProductImage $image
    ): JsonResponse {
        if ($image->product_id !== $product->id) {
            return response()->json([
                'success' => false,
                'message' => 'This image does not belong to the selected product.',
            ], 422);
        }

        $wasPrimary = $image->is_primary;
        $path = $image->image_path;

        DB::transaction(function () use ($image, $product, $wasPrimary) {
            $image->delete();

            if ($wasPrimary) {
                $nextImage = $product->images()
                    ->orderBy('sort_order')
                    ->first();

                if ($nextImage) {
                    $nextImage->update(['is_primary' => true]);
                }
            }
        });

        Storage::disk('public')->delete($path);

        return response()->json([
            'success' => true,
            'message' => 'Product image deleted successfully.',
            'data' => $product->fresh()->load('images'),
        ]);
    }

    // Admin: soft-delete a product.
    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product moved to the deleted items.',
        ]);
    }

    private function generateUniqueSlug(
        string $name,
        ?int $ignoreId = null
    ): string {
        $baseSlug = Str::slug($name);
        $slug = $baseSlug;
        $counter = 1;

        while (
            Product::where('slug', $slug)
                ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
                ->exists()
        ) {
            $slug = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    private function generateUniqueSku(): string
    {
        do {
            $sku = 'BF-' . Str::upper(Str::random(8));
        } while (Product::where('sku', $sku)->exists());

        return $sku;
    }
}
