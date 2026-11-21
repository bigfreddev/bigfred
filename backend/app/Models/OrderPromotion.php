<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderPromotion extends Model
{
    protected $fillable = [
        'order_id',
        'promotion_id',
        'promotion_name',
        'product_discount_amount',
        'delivery_discount_amount',
        'total_discount_amount',
    ];

    protected function casts(): array
    {
        return [
            'product_discount_amount' => 'decimal:2',
            'delivery_discount_amount' => 'decimal:2',
            'total_discount_amount' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }
}