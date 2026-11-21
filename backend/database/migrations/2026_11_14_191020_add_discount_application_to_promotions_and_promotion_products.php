<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->string('discount_application', 20)
                ->default('per_unit')
                ->after('discount_type');
        });

        Schema::table('promotion_products', function (Blueprint $table) {
            $table->string('discount_application', 20)
                ->default('per_unit')
                ->after('discount_type');
        });
    }

    public function down(): void
    {
        Schema::table('promotion_products', function (Blueprint $table) {
            $table->dropColumn('discount_application');
        });

        Schema::table('promotions', function (Blueprint $table) {
            $table->dropColumn('discount_application');
        });
    }
};