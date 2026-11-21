
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();

            $table->string('customer_name', 80);
            $table->string('customer_email')->nullable();

            // Product information used by the current frontend.
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('product_name');

            $table->unsignedTinyInteger('rating');
            $table->text('review_text');

            // New reviews must be approved before public display.
            $table->enum('status', [
                'pending',
                'approved',
                'rejected',
            ])->default('pending');

            // Only the backend should ever set this to true.
            $table->boolean('is_verified_purchase')->default(false);

            $table->timestamps();

            $table->index(['status', 'product_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
