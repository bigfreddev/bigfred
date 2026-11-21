<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();

            $table->string('name', 200);
            $table->text('description')->nullable();

            // percentage or fixed; nullable for free-delivery-only promotions
            $table->string('discount_type', 20)->nullable();
            $table->decimal('discount_value', 12, 2)->nullable();

            // When true, applies to all products.
            // Individual product overrides are stored in promotion_products.
            $table->boolean('applies_to_all_products')->default(true);

            $table->boolean('free_delivery')->default(false);

            $table->decimal('minimum_order_value', 12, 2)->nullable();

            $table->dateTime('starts_at');
            $table->dateTime('ends_at');

            // Manual admin enable/disable switch
            $table->boolean('is_enabled')->default(true);

            $table->timestamps();

            $table->index(['is_enabled', 'starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
    }
};