
<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\CustomerAuthController;
use App\Http\Controllers\Api\CustomerOrderController;

use App\Http\Controllers\Api\Admin\OrderManagementController;
use App\Http\Controllers\Api\Admin\OrderPaymentController;
use App\Http\Controllers\Api\Admin\AdminDashboardController;
use App\Http\Controllers\Api\Admin\DeliveryZoneController;
use App\Http\Controllers\Api\Admin\PromotionController;

/*
|--------------------------------------------------------------------------
| API Health Check
|--------------------------------------------------------------------------
*/

Route::get('/hello', function () {
    return response()->json([
        'success' => true,
        'message' => 'Hello from BigFred API!',
        'app' => 'BigFred',
    ]);
})->name('api.health');


/*
|--------------------------------------------------------------------------
| Public Storefront Routes
|--------------------------------------------------------------------------
*/

// Categories
Route::get('/categories', [CategoryController::class, 'index'])
    ->name('categories.index');

// Delivery Zones
Route::get('/delivery-zones', [DeliveryZoneController::class, 'index'])
    ->name('delivery-zones.index');

// Products
Route::get('/products', [ProductController::class, 'index'])
    ->name('products.index');

Route::get('/products/{slug}', [ProductController::class, 'show'])
    ->name('products.show');

// WhatsApp Business Settings
Route::get('/settings/whatsapp', [SettingController::class, 'showWhatsApp'])
    ->name('settings.whatsapp.show');

// Customer Reviews
Route::get('/reviews', [ReviewController::class, 'index'])
    ->name('reviews.index');

Route::post('/reviews', [ReviewController::class, 'store'])
    ->middleware('throttle:5,1')
    ->name('reviews.store');

// Customer Orders
Route::post('/orders', [OrderController::class, 'store'])
    ->middleware(['auth:sanctum', 'customer', 'throttle:10,1'])
    ->name('orders.store');


/*
|--------------------------------------------------------------------------
| Admin Authentication
|--------------------------------------------------------------------------
*/

Route::post('/admin/login', [AdminAuthController::class, 'login'])
    ->middleware('throttle:5,1')
    ->name('admin.login');


/*
|--------------------------------------------------------------------------
| Customer Authentication
|--------------------------------------------------------------------------
*/

Route::prefix('customer')
    ->name('customer.')
    ->group(function () {

        // Public Authentication
        Route::post('/register', [CustomerAuthController::class, 'register'])
            ->middleware('throttle:5,1')
            ->name('register');

        Route::post('/login', [CustomerAuthController::class, 'login'])
            ->middleware('throttle:5,1')
            ->name('login');

        // Protected Customer Routes
        Route::middleware(['auth:sanctum', 'customer'])->group(function () {

            Route::post('/logout', [CustomerAuthController::class, 'logout'])
                ->name('logout');

            Route::get('/me', [CustomerAuthController::class, 'me'])
                ->name('me');

            Route::get('/orders', [CustomerOrderController::class, 'index'])
                ->name('orders.index');

            Route::get('/orders/{order}', [CustomerOrderController::class, 'show'])
                ->name('orders.show');
        });
    });


/*
|--------------------------------------------------------------------------
| Protected Admin Routes
|--------------------------------------------------------------------------
*/

Route::prefix('admin')
    ->name('admin.')
    ->middleware(['auth:sanctum', 'admin'])
    ->group(function () {

// Delivery Zone Management
Route::get('/delivery-zones', [DeliveryZoneController::class, 'adminIndex']);

        // Promotion management
        Route::get('/promotions', [PromotionController::class, 'index'])
            ->name('promotions.index');

        Route::post('/promotions', [PromotionController::class, 'store'])
            ->name('promotions.store');

        Route::post('/promotions/preview', [PromotionController::class, 'preview'])
            ->name('promotions.preview');

        Route::get('/promotions/{promotion}', [PromotionController::class, 'show'])
            ->name('promotions.show');

        Route::put('/promotions/{promotion}', [PromotionController::class, 'update'])
            ->name('promotions.update');

        Route::patch('/promotions/{promotion}', [PromotionController::class, 'update']);

        Route::patch('/promotions/{promotion}/status', [PromotionController::class, 'updateStatus'])
            ->name('promotions.status.update');

        Route::delete('/promotions/{promotion}', [PromotionController::class, 'destroy'])
            ->name('promotions.destroy');
Route::post('/delivery-zones', [DeliveryZoneController::class, 'store']);
Route::put('/delivery-zones/{deliveryZone}', [DeliveryZoneController::class, 'update']);
Route::patch('/delivery-zones/{deliveryZone}', [DeliveryZoneController::class, 'update']);
Route::delete('/delivery-zones/{deliveryZone}', [DeliveryZoneController::class, 'destroy']);

        /*
        |--------------------------------------------------------------------------
        | Authentication
        |--------------------------------------------------------------------------
        */

        Route::post('/logout', [AdminAuthController::class, 'logout'])
            ->name('logout');

        Route::get('/me', [AdminAuthController::class, 'me'])
            ->name('me');


        /*
        |--------------------------------------------------------------------------
        | Dashboard Analytics
        |--------------------------------------------------------------------------
        */

        Route::get('/dashboard', [
            AdminDashboardController::class,
            'index',
        ])->name('dashboard.index');


        /*
        |--------------------------------------------------------------------------
        | Business Settings
        |--------------------------------------------------------------------------
        */

        Route::put('/settings/whatsapp', [SettingController::class, 'updateWhatsApp'])
            ->name('settings.whatsapp.update');


        /*
        |--------------------------------------------------------------------------
        | Category Management
        |--------------------------------------------------------------------------
        */

        Route::get('/categories', [CategoryController::class, 'adminIndex'])
            ->name('categories.index');

        Route::post('/categories', [CategoryController::class, 'store'])
            ->name('categories.store');

        Route::put('/categories/{category}', [CategoryController::class, 'update'])
            ->name('categories.update');

        Route::patch('/categories/{category}', [CategoryController::class, 'update']);

        Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])
            ->name('categories.destroy');

        /*
        |--------------------------------------------------------------------------
        | Product Management
        |--------------------------------------------------------------------------
        */

        Route::get('/products', [ProductController::class, 'adminIndex'])
            ->name('products.index');

        Route::post('/products', [ProductController::class, 'store'])
            ->name('products.store');

        Route::post('/products/{product}', [ProductController::class, 'update'])
            ->name('products.update');

        Route::delete('/products/{product}', [ProductController::class, 'destroy'])
            ->name('products.destroy');

        // Product Images
        Route::patch(
            '/products/{product}/images/{image}/primary',
            [ProductController::class, 'setPrimaryImage']
        )->name('products.images.primary');

        Route::delete(
            '/products/{product}/images/{image}',
            [ProductController::class, 'deleteImage']
        )->name('products.images.delete');


        /*
        |--------------------------------------------------------------------------
        | Review Management
        |--------------------------------------------------------------------------
        */

        Route::get('/reviews', [ReviewController::class, 'adminIndex'])
            ->name('reviews.index');

        Route::get('/reviews/statistics', [ReviewController::class, 'statistics'])
            ->name('reviews.statistics');

        Route::patch('/reviews/{review}/status', [ReviewController::class, 'updateStatus'])
            ->name('reviews.status.update');


        /*
        |--------------------------------------------------------------------------
        | Order Management
        |--------------------------------------------------------------------------
        */

        Route::get('/orders/statistics', [
            OrderManagementController::class,
            'statistics',
        ])->name('orders.statistics');

        Route::get('/orders', [
            OrderManagementController::class,
            'index',
        ])->name('orders.index');

        Route::post('/orders', [
            OrderManagementController::class,
            'store',
        ])->name('orders.store');

        Route::get('/orders/{order}', [
            OrderManagementController::class,
            'show',
        ])->name('orders.show');

        Route::patch('/orders/{order}', [
            OrderManagementController::class,
            'update',
        ])->name('orders.update');

        // Legacy Payment Status Route
        Route::patch('/orders/{order}/payment', [
            OrderManagementController::class,
            'updatePayment',
        ])->name('orders.payment.update');


        /*
        |--------------------------------------------------------------------------
        | Order Payment and Refund Transactions
        |--------------------------------------------------------------------------
        */

        Route::get('/orders/{order}/payments', [
            OrderPaymentController::class,
            'index',
        ])->name('orders.payments.index');

        Route::post('/orders/{order}/payments', [
            OrderPaymentController::class,
            'store',
        ])->name('orders.payments.store');
    });


/*
|--------------------------------------------------------------------------
| Authenticated User
|--------------------------------------------------------------------------
*/

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum')
    ->name('user.profile');
