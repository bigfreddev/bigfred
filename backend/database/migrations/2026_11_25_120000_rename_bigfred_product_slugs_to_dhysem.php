<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Store rebrand: product URLs that began with "bigfred-" now begin with
 * "dhysem-". The frontend redirects the old paths, so existing links keep working.
 */
return new class extends Migration
{
    public function up(): void
    {
        $products = DB::table('products')
            ->where('slug', 'like', 'bigfred-%')
            ->get(['id', 'slug']);

        foreach ($products as $product) {
            $base = 'dhysem-' . Str::after($product->slug, 'bigfred-');
            $slug = $base;
            $counter = 2;

            while (DB::table('products')->where('slug', $slug)->where('id', '!=', $product->id)->exists()) {
                $slug = $base . '-' . $counter++;
            }

            DB::table('products')->where('id', $product->id)->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        $products = DB::table('products')
            ->where('slug', 'like', 'dhysem-%')
            ->get(['id', 'slug']);

        foreach ($products as $product) {
            DB::table('products')
                ->where('id', $product->id)
                ->update(['slug' => 'bigfred-' . Str::after($product->slug, 'dhysem-')]);
        }
    }
};
