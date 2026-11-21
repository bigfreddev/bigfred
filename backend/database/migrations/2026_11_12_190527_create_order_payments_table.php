
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();

            // Associated order
            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            // Payment or refund transaction
            $table->enum('type', ['payment', 'refund'])
                ->default('payment');

            // Actual transaction amount in GH₵
            $table->decimal('amount', 12, 2);

            // Payment channel, e.g. Mobile Money, Cash or Bank Transfer
            $table->string('payment_method', 100)->nullable();

            // Optional external transaction reference
            $table->string('reference')->nullable();

            // Date the transaction actually occurred
            $table->timestamp('transaction_date');

            // Optional administrator notes
            $table->text('notes')->nullable();

            // Administrator who recorded the transaction
            $table->foreignId('recorded_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['order_id', 'type']);
            $table->index('transaction_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_payments');
    }
};
