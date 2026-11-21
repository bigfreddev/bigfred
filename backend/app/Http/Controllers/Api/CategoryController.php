<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    /**
     * Public: list active categories.
     */
    public function index(): JsonResponse
    {
        $categories = Category::where('is_active', true)
            ->withCount([
                'products' => function ($query) {
                    $query->where('is_active', true);
                },
            ])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Admin: list all categories.
     */
    public function adminIndex(): JsonResponse
    {
        $categories = Category::withCount('products')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Admin: create category.
     */
    public function store(Request $request): JsonResponse
    {
        $imageRules = $request->hasFile('image')
            ? ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']
            : ['nullable', 'string', 'max:255'];

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                'unique:categories,name',
            ],
            'description' => ['nullable', 'string'],
            'image' => $imageRules,
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $slug = Str::slug($validated['name']);

        if (Category::where('slug', $slug)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'A category with a similar name already exists.',
            ], 422);
        }

        if ($request->hasFile('image')) {
            $validated['image'] = $request->file('image')
                ->store('categories', 'public');
        }

        $validated['slug'] = $slug;

        $category = Category::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Category created successfully.',
            'data' => $category,
        ], 201);
    }

    /**
     * Admin: update category.
     */
    public function update(Request $request, Category $category): JsonResponse
    {
        $imageRules = $request->hasFile('image')
            ? ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']
            : ['nullable', 'string', 'max:255'];

        $validated = $request->validate([
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('categories', 'name')->ignore($category->id),
            ],
            'description' => ['sometimes', 'nullable', 'string'],
            'image' => $imageRules,
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'remove_image' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['name'])) {
            $slug = Str::slug($validated['name']);

            $slugExists = Category::where('slug', $slug)
                ->where('id', '!=', $category->id)
                ->exists();

            if ($slugExists) {
                return response()->json([
                    'success' => false,
                    'message' => 'A category with a similar name already exists.',
                ], 422);
            }

            $validated['slug'] = $slug;
        }

        $oldImage = $category->image;

        // A newly uploaded image takes priority over removal.
        if ($request->hasFile('image')) {
            $validated['image'] = $request->file('image')
                ->store('categories', 'public');

            unset($validated['remove_image']);
        } elseif ($request->boolean('remove_image')) {
            $validated['image'] = null;
            unset($validated['remove_image']);
        }

        $category->update($validated);

        // Delete the old uploaded file only after the database update.
        if (
            $oldImage &&
            $oldImage !== $category->image
        ) {
            $this->deleteStoredCategoryImage($oldImage);
        }

        return response()->json([
            'success' => true,
            'message' => 'Category updated successfully.',
            'data' => $category->fresh(),
        ]);
    }

    /**
     * Admin: delete category only when it has no products.
     */
    public function destroy(Category $category): JsonResponse
    {
        if ($category->products()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'This category cannot be deleted because it contains products.',
            ], 422);
        }

        $image = $category->image;

        $category->delete();

        if ($image) {
            $this->deleteStoredCategoryImage($image);
        }

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully.',
        ]);
    }

    /**
     * Delete only images managed by this controller.
     * External URLs and unrelated storage paths are left untouched.
     */
    private function deleteStoredCategoryImage(string $image): void
    {
        if (
            !str_starts_with($image, 'categories/') ||
            str_contains($image, '..')
        ) {
            return;
        }

        Storage::disk('public')->delete($image);
    }
}
