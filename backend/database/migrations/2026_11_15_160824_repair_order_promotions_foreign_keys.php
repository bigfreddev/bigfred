
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Remove only rows whose parent order no longer exists.
        // A backup of the 25 known orphaned test rows was created.
        DB::statement('
            DELETE op
            FROM order_promotions op
            LEFT JOIN orders o ON o.id = op.order_id
            WHERE o.id IS NULL
        ');

        // Preserve valid order history if its promotion was deleted.
        DB::statement('
            UPDATE order_promotions op
            LEFT JOIN promotions p ON p.id = op.promotion_id
            SET op.promotion_id = NULL
            WHERE op.promotion_id IS NOT NULL
              AND p.id IS NULL
        ');

        // MyISAM does not enforce foreign keys.
        DB::statement(
            'ALTER TABLE order_promotions ENGINE=InnoDB'
        );

        Schema::table('order_promotions', function (Blueprint $table) {
            $table->foreign('order_id', 'order_promotions_order_id_foreign')
                ->references('id')
                ->on('orders')
                ->cascadeOnDelete();

            $table->foreign('promotion_id', 'order_promotions_promotion_id_foreign')
                ->references('id')
                ->on('promotions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_promotions', function (Blueprint $table) {
            $table->dropForeign('order_promotions_order_id_foreign');
            $table->dropForeign('order_promotions_promotion_id_foreign');
        });

        // Keep the table as InnoDB when rolling back.
        // Do not restore MyISAM, which cannot enforce foreign keys.
    }
};
