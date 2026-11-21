<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeliveryZone extends Model
{
    protected $fillable = [
        'name',
        'description',
        'delivery_fee',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'delivery_fee' => 'decimal:2',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function promotions(): BelongsToMany
    {
        return $this->belongsToMany(
            Promotion::class,
            'promotion_delivery_zones'
        )->withTimestamps();
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
