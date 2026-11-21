<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'user_id',
        'order_number',
        'customer_name',
        'customer_phone',
        'customer_email',
        'delivery_address',
        'delivery_location',
        'source',
        'status',
        'subtotal',
        'delivery_fee',
        'total',
        'payment_method',
        'payment_status',
        'customer_notes',
        'admin_notes',
        'created_by',
        'cancellation_reason',
        'cancelled_at',
        'restock_status',
        'promotion_id',
        'promotion_name',
        'product_discount_amount',
        'original_delivery_fee',
        'delivery_discount_amount',
        'delivery_zone_id',
        'delivery_zone_name',
        'delivery_quote_pending',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'total' => 'decimal:2',
            'cancelled_at' => 'datetime',
            'product_discount_amount' => 'decimal:2',
            'original_delivery_fee' => 'decimal:2',
            'delivery_discount_amount' => 'decimal:2',
            'delivery_quote_pending' => 'boolean',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(OrderPayment::class);
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    public function deliveryZone(): BelongsTo
    {
        return $this->belongsTo(DeliveryZone::class);
    }
    public function appliedPromotions(): HasMany
    {
        return $this->hasMany(OrderPromotion::class);
    }
}