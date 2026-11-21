<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('original_unit_price', 12, 2)
                ->default(0)
                ->after('unit_price');

            $table->decimal('discount_amount', 12, 2)
                ->default(0)
                ->after('original_unit_price');
        });

        // Preserve the original prices of all existing order items.
        DB::table('order_items')->update([
            'original_unit_price' => DB::raw('unit_price'),
        ]);
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn([
                'original_unit_price',
                'discount_amount',
            ]);
        });
    }
};