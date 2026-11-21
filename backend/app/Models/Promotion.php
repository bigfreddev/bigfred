<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Promotion extends Model
{
    protected $fillable = [
        'name',
        'description',
        'discount_type',
        'discount_application',
        'discount_value',
        'applies_to_all_products',
        'free_delivery',
        'can_combine',
        'minimum_order_value',
        'starts_at',
        'ends_at',
        'is_enabled',
    ];

    protected function casts(): array
    {
        return [
            'discount_value' => 'decimal:2',
            'applies_to_all_products' => 'boolean',
            'free_delivery' => 'boolean',
            'can_combine' => 'boolean',
            'minimum_order_value' => 'decimal:2',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_enabled' => 'boolean',
        ];
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(
            Product::class,
            'promotion_products'
        )->withPivot([
            'discount_type',
            'discount_application',
            'discount_value',
        ])->withTimestamps();
    }

    public function deliveryZones(): BelongsToMany
    {
        return $this->belongsToMany(
            DeliveryZone::class,
            'promotion_delivery_zones'
        )->withTimestamps();
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function isCurrentlyActive(): bool
    {
        return $this->is_enabled
            && $this->starts_at
            && $this->ends_at
            && $this->starts_at->lte(now())
            && $this->ends_at->gte(now());
    }

    public function getStatusAttribute(): string
    {
        if (!$this->is_enabled) {
            return 'disabled';
        }

        if ($this->starts_at && $this->starts_at->isFuture()) {
            return 'scheduled';
        }

        if ($this->ends_at && $this->ends_at->isPast()) {
            return 'expired';
        }

        return 'active';
    }
}
