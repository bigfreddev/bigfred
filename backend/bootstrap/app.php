
<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Enable Sanctum authentication for stateful API requests.
        $middleware->statefulApi();

        // Return API authentication errors instead of redirecting to a login page.
        $middleware->redirectGuestsTo(function (Request $request): ?string {
            if ($request->is('api/*')) {
                return null;
            }

            return route('login');
        });

        // Register custom admin middleware.
$middleware->alias([
    'admin' => \App\Http\Middleware\EnsureUserIsAdmin::class,
    'customer' => \App\Http\Middleware\EnsureUserIsCustomer::class,
]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Ensure API exceptions are returned as JSON.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*')
                || $request->expectsJson(),
        );
    })
    ->create();
