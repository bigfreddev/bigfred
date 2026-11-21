<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();

            $table->foreignId('category_id')
                ->constrained('categories')
                ->restrictOnDelete();

            $table->string('name', 200);
            $table->string('slug', 220)->unique();
            $table->string('sku', 100)->unique();

            $table->text('short_description')->nullable();
            $table->longText('description')->nullable();

            $table->decimal('price', 12, 2);
            $table->decimal('compare_at_price', 12, 2)->nullable();

            $table->unsignedInteger('stock_quantity')->default(0);
            $table->unsignedInteger('low_stock_threshold')->default(5);

            $table->boolean('is_featured')->default(false);
            $table->boolean('is_active')->default(true);

            $table->timestamps();
            $table->softDeletes();

            $table->index(['category_id', 'is_active']);
            $table->index(['is_featured', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};