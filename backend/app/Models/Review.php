<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    protected $fillable = [
        'customer_name',
        'customer_email',
        'product_id',
        'product_name',
        'rating',
        'review_text',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'product_id' => 'integer',
            'is_verified_purchase' => 'boolean',
        ];
    }
}
