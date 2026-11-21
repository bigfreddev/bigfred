<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add promotion_id only if it does not already exist.
        // It was partially created during the previous failed attempt.
        if (!Schema::hasColumn('orders', 'promotion_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->unsignedBigInteger('promotion_id')
                    ->nullable()
                    ->after('delivery_fee');
            });
        }

        // Add the remaining order columns only when missing.
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'promotion_name')) {
                $table->string('promotion_name', 200)->nullable();
            }

            if (!Schema::hasColumn('orders', 'product_discount_amount')) {
                $table->decimal('product_discount_amount', 12, 2)->default(0);
            }

            if (!Schema::hasColumn('orders', 'original_delivery_fee')) {
                $table->decimal('original_delivery_fee', 12, 2)->default(0);
            }

            if (!Schema::hasColumn('orders', 'delivery_discount_amount')) {
                $table->decimal('delivery_discount_amount', 12, 2)->default(0);
            }

            if (!Schema::hasColumn('orders', 'delivery_zone_id')) {
                $table->unsignedBigInteger('delivery_zone_id')->nullable();
            }

            if (!Schema::hasColumn('orders', 'delivery_zone_name')) {
                $table->string('delivery_zone_name', 150)->nullable();
            }

            if (!Schema::hasColumn('orders', 'delivery_quote_pending')) {
                $table->boolean('delivery_quote_pending')->default(false);
            }
        });

        // Create the foreign keys if they are not already present.
        $foreignKeys = collect(Schema::getForeignKeys('orders'))
            ->pluck('name')
            ->all();

        if (!in_array('orders_promotion_id_foreign', $foreignKeys, true)) {
            Schema::table('orders', function (Blueprint $table) {
                $table->foreign('promotion_id')
                    ->references('id')
                    ->on('promotions')
                    ->nullOnDelete();
            });
        }

        if (!in_array('orders_delivery_zone_id_foreign', $foreignKeys, true)) {
            Schema::table('orders', function (Blueprint $table) {
                $table->foreign('delivery_zone_id')
                    ->references('id')
                    ->on('delivery_zones')
                    ->nullOnDelete();
            });
        }

        // Preserve historical delivery fees.
        DB::table('orders')
            ->where('original_delivery_fee', 0)
            ->where('delivery_fee', '>', 0)
            ->update([
                'original_delivery_fee' => DB::raw('delivery_fee'),
            ]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $foreignKeys = collect(Schema::getForeignKeys('orders'))
                ->pluck('name')
                ->all();

            if (in_array('orders_promotion_id_foreign', $foreignKeys, true)) {
                $table->dropForeign('orders_promotion_id_foreign');
            }

            if (in_array('orders_delivery_zone_id_foreign', $foreignKeys, true)) {
                $table->dropForeign('orders_delivery_zone_id_foreign');
            }

            $columns = [
                'promotion_id',
                'promotion_name',
                'product_discount_amount',
                'original_delivery_fee',
                'delivery_discount_amount',
                'delivery_zone_id',
                'delivery_zone_name',
                'delivery_quote_pending',
            ];

            $existingColumns = array_filter(
                $columns,
                fn ($column) => Schema::hasColumn('orders', $column)
            );

            if (!empty($existingColumns)) {
                $table->dropColumn($existingColumns);
            }
        });
    }
};
