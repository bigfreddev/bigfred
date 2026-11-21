<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderPaymentController extends Controller
{
    /**
     * List payment and refund transactions for an order.
     */
    public function index(Order $order)
    {
        $payments = $order->payments()
            ->with('recorder:id,name')
            ->latest('transaction_date')
            ->paginate(15);

        return response()->json($payments);
    }

    /**
     * Record a payment or refund against an order.
     */
    public function store(Request $request, Order $order)
    {
        $validated = $request->validate([
            'type' => [
                'required',
                Rule::in(['payment', 'refund']),
            ],

            'amount' => [
                'required',
                'numeric',
                'gt:0',
                'decimal:0,2',
            ],

            'payment_method' => [
                'nullable',
                'string',
                'max:100',
            ],

            'reference' => [
                'nullable',
                'string',
                'max:255',
            ],

            'transaction_date' => [
                'nullable',
                'date',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $result = DB::transaction(function () use (
            $validated,
            $request,
            $order
        ) {
            // Lock the order to serialize payment/refund updates.
            $lockedOrder = Order::whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            $amount = round((float) $validated['amount'], 2);
            $type = $validated['type'];

            // Calculate existing transaction totals.
            $grossPayments = round(
                (float) $lockedOrder->payments()
                    ->where('type', 'payment')
                    ->sum('amount'),
                2
            );

            $totalRefunds = round(
                (float) $lockedOrder->payments()
                    ->where('type', 'refund')
                    ->sum('amount'),
                2
            );

            $netPaid = round(
                $grossPayments - $totalRefunds,
                2
            );

            $orderTotal = round(
                (float) $lockedOrder->total,
                2
            );

            /*
             * Validate incoming payment.
             */
            if ($type === 'payment') {
                if ($lockedOrder->status === 'cancelled') {
                    throw ValidationException::withMessages([
                        'type' => [
                            'Payments cannot be recorded against cancelled orders.',
                        ],
                    ]);
                }

                $outstanding = round(
                    $orderTotal - $netPaid,
                    2
                );

                if ($amount > $outstanding) {
                    throw ValidationException::withMessages([
                        'amount' => [
                            'Payment exceeds the outstanding order balance of GHS ' .
                            number_format(max(0, $outstanding), 2) . '.',
                        ],
                    ]);
                }
            }

            /*
             * Validate refund.
             *
             * A refund cannot exceed the amount still retained.
             */
            if ($type === 'refund' && $amount > $netPaid) {
                throw ValidationException::withMessages([
                    'amount' => [
                        'Refund exceeds the available refundable balance of GHS ' .
                        number_format(max(0, $netPaid), 2) . '.',
                    ],
                ]);
            }

            /*
             * Record the transaction.
             */
            $transaction = $lockedOrder->payments()->create([
                'type' => $type,
                'amount' => $amount,
                'payment_method' => $validated['payment_method'] ?? null,
                'reference' => $validated['reference'] ?? null,
                'transaction_date' => $validated['transaction_date'] ?? now(),
                'notes' => $validated['notes'] ?? null,
                'recorded_by' => $request->user()->id,
            ]);

            /*
             * Update transaction totals.
             */
            if ($type === 'payment') {
                $grossPayments = round(
                    $grossPayments + $amount,
                    2
                );
            } else {
                $totalRefunds = round(
                    $totalRefunds + $amount,
                    2
                );
            }

            $netPaid = round(
                $grossPayments - $totalRefunds,
                2
            );

            /*
             * Determine payment status.
             */
            if ($grossPayments > 0 && $netPaid <= 0) {
                $paymentStatus = 'refunded';

            } elseif (
                $orderTotal > 0 &&
                $netPaid >= $orderTotal
            ) {
                $paymentStatus = 'paid';

            } elseif ($netPaid > 0) {
                $paymentStatus = 'partially_paid';

            } else {
                $paymentStatus = 'unpaid';
            }

            $lockedOrder->payment_status = $paymentStatus;

            // Keep the latest payment method on the order.
            if (
                $type === 'payment' &&
                !empty($validated['payment_method'])
            ) {
                $lockedOrder->payment_method =
                    $validated['payment_method'];
            }

            $lockedOrder->save();

            return [
                'transaction' => $transaction->load('recorder:id,name'),

                'gross_payments' => $grossPayments,

                'total_refunds' => $totalRefunds,

                'net_paid' => $netPaid,

                'outstanding_balance' => round(
                    max(0, $orderTotal - $netPaid),
                    2
                ),

                'payment_status' => $paymentStatus,
            ];
        });

        return response()->json([
            'message' => $validated['type'] === 'payment'
                ? 'Payment recorded successfully.'
                : 'Refund recorded successfully.',

            ...$result,
        ], 201);
    }
}
