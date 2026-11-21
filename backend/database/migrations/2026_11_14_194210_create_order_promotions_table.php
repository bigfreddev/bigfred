<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_promotions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            // Nullable so historical records survive promotion deletion.
            $table->foreignId('promotion_id')
                ->nullable()
                ->constrained('promotions')
                ->nullOnDelete();

            // Snapshot of the promotion at the time of purchase.
            $table->string('promotion_name', 200);

            $table->decimal('product_discount_amount', 12, 2)
                ->default(0);

            $table->decimal('delivery_discount_amount', 12, 2)
                ->default(0);

            $table->decimal('total_discount_amount', 12, 2)
                ->default(0);

            $table->timestamps();

            $table->index(['order_id', 'promotion_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_promotions');
    }
};