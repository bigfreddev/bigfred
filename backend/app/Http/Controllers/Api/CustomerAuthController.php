<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class CustomerAuthController extends Controller
{
    /**
     * Register a new customer.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $customer = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
        ]);

        // Automatically log in the newly registered customer.
        Auth::guard('web')->login($customer);

        $request->session()->regenerate();

        return response()->json([
            'success' => true,
            'message' => 'Customer account created successfully.',
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
            ],
        ], 201);
    }

    /**
     * Log in an existing customer.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::guard('web')->attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $request->session()->regenerate();

        $customer = Auth::guard('web')->user();

        // Administrators must use the separate admin login.
        if ($customer->is_admin) {
            Auth::guard('web')->logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'success' => false,
                'message' => 'Please use the administrator login.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Customer login successful.',
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
            ],
        ]);
    }

    /**
     * Log out the authenticated customer.
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'success' => true,
            'message' => 'Customer logged out successfully.',
        ]);
    }

    /**
     * Return the authenticated customer's profile.
     */
    public function me(Request $request): JsonResponse
    {
        $customer = $request->user();

        return response()->json([
            'success' => true,
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
            ],
        ]);
    }
}
