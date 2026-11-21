<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    /**
     * Publicly retrieve the WhatsApp business number.
     */
    public function showWhatsApp()
    {
        $setting = Setting::where('key', 'whatsapp_number')->first();

        return response()->json([
            'success' => true,
            'data' => [
                'whatsapp_number' => $setting?->value,
            ],
        ]);
    }

    /**
     * Admin updates the WhatsApp business number.
     */
    public function updateWhatsApp(Request $request)
    {
        $validated = $request->validate([
            'whatsapp_number' => [
                'required',
                'string',
                'max:20',
                'regex:/^[0-9+\s()-]+$/',
            ],
        ]);

        $number = preg_replace(
            '/[\s()+-]/',
            '',
            $validated['whatsapp_number']
        );

        if (!preg_match('/^[0-9]{7,15}$/', $number)) {
            return response()->json([
                'success' => false,
                'message' => 'Please enter a valid international phone number.',
            ], 422);
        }

        Setting::updateOrCreate(
            ['key' => 'whatsapp_number'],
            ['value' => $number]
        );

        return response()->json([
            'success' => true,
            'message' => 'WhatsApp business number updated successfully.',
            'data' => [
                'whatsapp_number' => $number,
            ],
        ]);
    }
}
