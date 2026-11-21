
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();

            // Unique order reference
            $table->string('order_number')->unique();

            // Customer information
            $table->string('customer_name');
            $table->string('customer_phone');
            $table->string('customer_email')->nullable();

            // Delivery information
            $table->text('delivery_address');
            $table->string('delivery_location')->nullable();

            // Order source and status
            $table->string('source')->default('website');
            $table->string('status')->default('awaiting_confirmation');

            // Financial information
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('delivery_fee', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);

            // Payment tracking (no online payment gateway yet)
            $table->string('payment_method')->nullable();
            $table->string('payment_status')->default('unpaid');

            // Additional information
            $table->text('customer_notes')->nullable();
            $table->text('admin_notes')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['source', 'created_at']);
            $table->index('customer_phone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
