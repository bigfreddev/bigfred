
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addForeignKeyIfMissing(
            'promotion_products',
            'promotion_id',
            'promotions',
            'promotion_products_promotion_id_foreign'
        );

        $this->addForeignKeyIfMissing(
            'promotion_products',
            'product_id',
            'products',
            'promotion_products_product_id_foreign'
        );

        $this->addForeignKeyIfMissing(
            'promotion_delivery_zones',
            'promotion_id',
            'promotions',
            'promotion_delivery_zones_promotion_id_foreign'
        );

        $this->addForeignKeyIfMissing(
            'promotion_delivery_zones',
            'delivery_zone_id',
            'delivery_zones',
            'promotion_delivery_zones_delivery_zone_id_foreign'
        );
    }

    private function addForeignKeyIfMissing(
        string $table,
        string $column,
        string $referencedTable,
        string $constraintName
    ): void {
        $foreignKeys = collect(
            Schema::getForeignKeys($table)
        );

        $exists = $foreignKeys->contains(
            fn ($foreignKey) =>
                ($foreignKey['name'] ?? null) === $constraintName
        );

        if (!$exists) {
            Schema::table($table, function (Blueprint $blueprint) use (
                $column,
                $referencedTable,
                $constraintName
            ) {
                $blueprint->foreign($column, $constraintName)
                    ->references('id')
                    ->on($referencedTable)
                    ->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach ([
            'promotion_products' => [
                'promotion_products_promotion_id_foreign',
                'promotion_products_product_id_foreign',
            ],
            'promotion_delivery_zones' => [
                'promotion_delivery_zones_promotion_id_foreign',
                'promotion_delivery_zones_delivery_zone_id_foreign',
            ],
        ] as $table => $constraints) {
            $existing = collect(Schema::getForeignKeys($table))
                ->pluck('name')
                ->all();

            foreach ($constraints as $constraint) {
                if (in_array($constraint, $existing, true)) {
                    Schema::table($table, function (Blueprint $blueprint) use ($constraint) {
                        $blueprint->dropForeign($constraint);
                    });
                }
            }
        }
    }
};
