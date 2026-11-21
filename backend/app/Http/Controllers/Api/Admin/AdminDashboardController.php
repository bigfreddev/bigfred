<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    /**
     * Return live dashboard analytics.
     *
     * Supported periods: 7d, 30d, 12m.
     *
     * Financial activity uses payment transaction dates.
     * Order and product performance use order creation dates.
     */
    public function index(Request $request)
    {
        $validated = $request->validate([
            'period' => ['sometimes', 'required', 'in:7d,30d,12m'],
        ]);

        $period = $validated['period'] ?? '30d';

        $today = Carbon::today();

        if ($period === '7d') {
            $startDate = $today->copy()->subDays(6);
            $previousStartDate = $startDate->copy()->subDays(7);
            $previousEndDate = $startDate->copy()->subSecond();

            $groupFormat = '%Y-%m-%d';
            $dateFormat = 'Y-m-d';
            $labelFormat = 'D, d M';
        } elseif ($period === '12m') {
            $startDate = $today->copy()->startOfMonth()->subMonths(11);
            $previousStartDate = $startDate->copy()->subMonths(12);
            $previousEndDate = $startDate->copy()->subSecond();

            $groupFormat = '%Y-%m';
            $dateFormat = 'Y-m';
            $labelFormat = 'M Y';
        } else {
            $startDate = $today->copy()->subDays(29);
            $previousStartDate = $startDate->copy()->subDays(30);
            $previousEndDate = $startDate->copy()->subSecond();

            $groupFormat = '%Y-%m-%d';
            $dateFormat = 'Y-m-d';
            $labelFormat = 'D, d M';
        }

        $endDate = $today->copy()->endOfDay();

        $currentStart = $startDate->copy()->startOfDay();
        $previousStart = $previousStartDate->copy()->startOfDay();

        /*
         * Only confirmed and later-stage orders count as sales.
         * Awaiting confirmation and cancelled orders are excluded.
         */
        $salesStatuses = [
            'confirmed',
            'processing',
            'ready_for_delivery',
            'out_for_delivery',
            'completed',
        ];

        /*
         * Financial totals for the selected period.
         * Payments and refunds are based on transaction_date.
         */
        $currentRevenueTotals = DB::table('order_payments')
            ->whereBetween('transaction_date', [
                $currentStart,
                $endDate,
            ])
            ->selectRaw("
                COALESCE(SUM(
                    CASE WHEN type = 'payment' THEN amount ELSE 0 END
                ), 0) as gross_payments
            ")
            ->selectRaw("
                COALESCE(SUM(
                    CASE WHEN type = 'refund' THEN amount ELSE 0 END
                ), 0) as total_refunds
            ")
            ->first();

        $grossPayments = (float) $currentRevenueTotals->gross_payments;
        $totalRefunds = (float) $currentRevenueTotals->total_refunds;
        $netRevenue = round($grossPayments - $totalRefunds, 2);

        /*
         * Previous-period financial totals.
         */
        $previousRevenueTotals = DB::table('order_payments')
            ->whereBetween('transaction_date', [
                $previousStart,
                $previousEndDate,
            ])
            ->selectRaw("
                COALESCE(SUM(
                    CASE WHEN type = 'payment' THEN amount ELSE 0 END
                ), 0) as gross_payments
            ")
            ->selectRaw("
                COALESCE(SUM(
                    CASE WHEN type = 'refund' THEN amount ELSE 0 END
                ), 0) as total_refunds
            ")
            ->first();

        $previousGrossPayments = (float) $previousRevenueTotals->gross_payments;
        $previousRefunds = (float) $previousRevenueTotals->total_refunds;
        $previousNetRevenue = round(
            $previousGrossPayments - $previousRefunds,
            2
        );

        /*
         * Revenue and refunds grouped by transaction date.
         */
        $paymentTrend = DB::table('order_payments')
            ->whereBetween('transaction_date', [
                $currentStart,
                $endDate,
            ])
            ->selectRaw(
                "DATE_FORMAT(transaction_date, '{$groupFormat}') as period"
            )
            ->selectRaw("
                COALESCE(SUM(
                    CASE WHEN type = 'payment' THEN amount ELSE 0 END
                ), 0) as payments
            ")
            ->selectRaw("
                COALESCE(SUM(
                    CASE WHEN type = 'refund' THEN amount ELSE 0 END
                ), 0) as refunds
            ")
            ->groupBy('period')
            ->orderBy('period')
            ->get()
            ->keyBy('period');

        /*
         * Orders created during the selected period.
         */
        $periodOrders = Order::query()
            ->whereBetween('created_at', [
                $currentStart,
                $endDate,
            ]);

        $totalPeriodOrders = (clone $periodOrders)->count();

        $previousPeriodOrders = Order::query()
            ->whereBetween('created_at', [
                $previousStart,
                $previousEndDate,
            ])
            ->count();

        /*
         * Orders grouped by creation date for the chart.
         */
        $orderTrend = Order::query()
            ->whereBetween('created_at', [
                $currentStart,
                $endDate,
            ])
            ->selectRaw(
                "DATE_FORMAT(created_at, '{$groupFormat}') as period"
            )
            ->selectRaw('COUNT(*) as total_orders')
            ->groupBy('period')
            ->get()
            ->keyBy('period');

        /*
         * Build a continuous chart series, including zero-value dates.
         */
        $chart = [];

        if ($period === '12m') {
            $datePeriod = CarbonPeriod::create(
                $startDate->copy()->startOfMonth(),
                '1 month',
                $today->copy()->startOfMonth()
            );
        } else {
            $datePeriod = CarbonPeriod::create(
                $startDate->copy()->startOfDay(),
                '1 day',
                $today->copy()->startOfDay()
            );
        }

        foreach ($datePeriod as $date) {
            $key = $date->format($dateFormat);

            $payments = (float) (
                $paymentTrend->get($key)->payments ?? 0
            );

            $refunds = (float) (
                $paymentTrend->get($key)->refunds ?? 0
            );

            $chart[] = [
                'date' => $key,
                'label' => $date->format($labelFormat),
                'revenue' => round($payments - $refunds, 2),
                'payments' => round($payments, 2),
                'refunds' => round($refunds, 2),
                'orders' => (int) (
                    $orderTrend->get($key)->total_orders ?? 0
                ),
            ];
        }

        /*
         * Lifetime order status breakdown.
         * This intentionally includes all orders.
         */
        $orderStatuses = [
            'awaiting_confirmation',
            'confirmed',
            'processing',
            'ready_for_delivery',
            'out_for_delivery',
            'completed',
            'cancelled',
        ];

        $statusCounts = Order::query()
            ->select('status')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $orderBreakdown = [];

        foreach ($orderStatuses as $status) {
            $orderBreakdown[$status] = (int) (
                $statusCounts->get($status, 0)
            );
        }

        /*
         * Current product and inventory metrics.
         * Eloquent automatically excludes soft-deleted products.
         */
        $activeProducts = Product::query()
            ->where('is_active', true);

        $totalProducts = (clone $activeProducts)->count();

        $outOfStockProducts = (clone $activeProducts)
            ->where('stock_quantity', '<=', 0)
            ->count();

        $lowStockProducts = (clone $activeProducts)
            ->where('stock_quantity', '>', 0)
            ->whereColumn(
                'stock_quantity',
                '<=',
                'low_stock_threshold'
            )
            ->count();

        /*
         * Customer metrics.
         */
        $customerQuery = DB::table('users')
            ->where('is_admin', false);

        $totalCustomers = (clone $customerQuery)->count();

        $newCustomers = (clone $customerQuery)
            ->whereBetween('created_at', [
                $currentStart,
                $endDate,
            ])
            ->count();

        $previousNewCustomers = (clone $customerQuery)
            ->whereBetween('created_at', [
                $previousStart,
                $previousEndDate,
            ])
            ->count();

        /*
         * Review moderation metrics.
         * These are lifetime figures.
         */
        $reviewCounts = DB::table('reviews')
            ->select('status')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        /*
         * Recent orders.
         */
        $recentOrders = Order::query()
            ->with('items')
            ->latest('created_at')
            ->limit(8)
            ->get();

        /*
         * Top-selling products for the selected period.
         *
         * Only confirmed and later-stage orders count.
         * Awaiting-confirmation and cancelled orders are excluded.
         */
        $topProducts = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('orders.status', $salesStatuses)
            ->whereBetween('orders.created_at', [
                $currentStart,
                $endDate,
            ])
            ->select(
                'order_items.product_id',
                'order_items.product_name'
            )
            ->selectRaw('SUM(order_items.quantity) as units_sold')
            ->selectRaw('SUM(order_items.line_total) as sales_value')
            ->groupBy(
                'order_items.product_id',
                'order_items.product_name'
            )
            ->orderByDesc('units_sold')
            ->limit(5)
            ->get();

        /*
         * Period comparison percentages.
         * If the previous period is zero, return null rather than
         * displaying a misleading percentage.
         */
        $revenueChange = $previousNetRevenue != 0
            ? round(
                (($netRevenue - $previousNetRevenue) / abs($previousNetRevenue)) * 100,
                2
            )
            : null;

        $ordersChange = $previousPeriodOrders > 0
            ? round(
                (($totalPeriodOrders - $previousPeriodOrders) / $previousPeriodOrders) * 100,
                2
            )
            : null;

        $customersChange = $previousNewCustomers > 0
            ? round(
                (($newCustomers - $previousNewCustomers) / $previousNewCustomers) * 100,
                2
            )
            : null;

        return response()->json([
            'currency' => 'GHS',

            'period' => $period,

            'summary' => [
                // Selected-period financial and order figures.
                'total_revenue' => $netRevenue,
                'gross_payments' => round($grossPayments, 2),
                'total_refunds' => round($totalRefunds, 2),
                'total_orders' => $totalPeriodOrders,

                // Lifetime customer count.
                'total_customers' => $totalCustomers,

                // Selected-period customer registrations.
                'new_customers' => $newCustomers,

                // Current inventory figures.
                'total_products' => $totalProducts,
                'low_stock_products' => $lowStockProducts,
                'out_of_stock_products' => $outOfStockProducts,

                // Lifetime order and review figures.
                'pending_orders' => $orderBreakdown['awaiting_confirmation'],
                'pending_reviews' => (int) (
                    $reviewCounts->get('pending', 0)
                ),
                'total_reviews' => (int) $reviewCounts->sum(),
                'total_categories' => DB::table('categories')->count(),
            ],

            'comparison' => [
                'previous_period' => [
                    'net_revenue' => $previousNetRevenue,
                    'gross_payments' => round($previousGrossPayments, 2),
                    'refunds' => round($previousRefunds, 2),
                    'orders' => $previousPeriodOrders,
                    'new_customers' => $previousNewCustomers,
                ],
                'percentage_change' => [
                    'net_revenue' => $revenueChange,
                    'orders' => $ordersChange,
                    'new_customers' => $customersChange,
                ],
            ],

            'orders' => [
                'statuses' => $orderBreakdown,
                'recent' => $recentOrders,
            ],

            'revenue' => [
                'gross_payments' => round($grossPayments, 2),
                'refunds' => round($totalRefunds, 2),
                'net_revenue' => $netRevenue,
                'chart' => $chart,
            ],

            'inventory' => [
                'total_products' => $totalProducts,
                'low_stock' => $lowStockProducts,
                'out_of_stock' => $outOfStockProducts,
                'top_selling' => $topProducts,
            ],

            'customers' => [
                'total' => $totalCustomers,
                'new_in_period' => $newCustomers,
            ],

            'reviews' => [
                'pending' => (int) $reviewCounts->get('pending', 0),
                'approved' => (int) $reviewCounts->get('approved', 0),
                'rejected' => (int) $reviewCounts->get('rejected', 0),
            ],
        ]);
    }
}
