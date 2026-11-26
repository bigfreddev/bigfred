"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type OrderItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  product_sku?: string | null;
  unit_price: string | number;
  quantity: number;
  line_total: string | number;
};

type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  delivery_address: string;
  delivery_location?: string | null;
  source: "website" | "manual";
  status: string;
  subtotal: string | number;
  delivery_fee: string | number;
  total: string | number;
  payment_status: string;
  payment_method?: string | null;
  customer_notes?: string | null;
  admin_notes?: string | null;
  cancellation_reason?: string | null;
  restock_status?: string;
  created_at: string;
  items: OrderItem[];
};

type PaymentTransaction = {
  id: number;
  order_id: number;
  type: "payment" | "refund";
  amount: string | number;
  payment_method?: string | null;
  reference?: string | null;
  transaction_date?: string | null;
  notes?: string | null;
  created_at: string;
  recorder?: {
    name: string;
  } | null;
};

type PaymentSummary = {
  gross_payments: number;
  total_refunds: number;
  net_paid: number;
  outstanding_balance: number;
  payment_status: string;
};

type Product = {
  id: number;
  name: string;
  sku?: string;
  price: string | number;
  stock_quantity: number;
};

type Statistics = {
  total_orders: number;
  awaiting_confirmation: number;
  confirmed: number;
  processing: number;
  ready_for_delivery: number;
  out_for_delivery: number;
  completed: number;
  cancelled: number;
  total_revenue: number;
};

type Pagination = {
  current_page: number;
  last_page: number;
  total: number;
};

type NewOrderItem = {
  product_id: string;
  quantity: number;
};


const orderStatuses = [
  "awaiting_confirmation",
  "confirmed",
  "processing",
  "ready_for_delivery",
  "out_for_delivery",
  "completed",
  "cancelled",
];


const formatMoney = (value: string | number) =>
  `GH₵ ${Number(value || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatStatus = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const statusStyle = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-50 text-green-700";
    case "cancelled":
      return "bg-red-50 text-red-600";
    case "awaiting_confirmation":
      return "bg-amber-50 text-amber-700";
    case "out_for_delivery":
      return "bg-blue-50 text-blue-700";
    case "processing":
    case "ready_for_delivery":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-[#f6e9e7] text-[#95676a]";
  }
};

export default function AdminOrders() {

  const [orders, setOrders] = useState<Order[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);

  const router = useRouter();


  const handleAuthError = useCallback((err: unknown): boolean => {

    const status = isAxiosError(err) ? err.response?.status : undefined;


    if (status === 401 || status === 403) {

      router.replace("/admin/login");

      return true;

    }


    return false;

  }, [router]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [newOrder, setNewOrder] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    delivery_address: "",
    delivery_location: "",
    delivery_fee: "0",
    customer_notes: "",
    admin_notes: "",
    items: [{ product_id: "", quantity: 1 }] as NewOrderItem[],
  });

  const [statusUpdate, setStatusUpdate] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({
    gross_payments: 0,
    total_refunds: 0,
    net_paid: 0,
    outstanding_balance: 0,
    payment_status: "unpaid",
  });

  const [transactionType, setTransactionType] = useState<"payment" | "refund">("payment");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("Mobile Money");
  const [transactionReference, setTransactionReference] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [transactionNotes, setTransactionNotes] = useState("");
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Load orders and statistics
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [ordersResponse, statisticsResponse] = await Promise.all([
        api.get("/admin/orders", {
          params: {
            page,
            search: search || undefined,
            status: statusFilter || undefined,
            source: sourceFilter || undefined,
          },
        }),
        api.get("/admin/orders/statistics"),
      ]);

      const result = ordersResponse.data;

      setOrders(result.data ?? []);
      setPagination({
        current_page: result.current_page ?? 1,
        last_page: result.last_page ?? 1,
        total: result.total ?? 0,
      });

      setStatistics(statisticsResponse.data);
    } catch (err: unknown) {
      const errorData = isAxiosError(err) ? err.response?.data : undefined;
      if (handleAuthError(err)) return;

      setError(
        errorData?.message ||
          "Unable to load orders. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter, handleAuthError]);

  useEffect(() => {
    // This effect initiates the asynchronous orders request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, [loadOrders]);


// Load products for manual orders
const loadProducts = async () => {
  try {
    const response = await api.get("/admin/products", {
      params: { per_page: 100 },
    });

    const result = response.data;

    // Handle different Laravel API response structures.
    const possibleProductLists = [
      result,
      result?.data,
      result?.data?.data,
      result?.products,
      result?.products?.data,
      result?.data?.products,
      result?.data?.products?.data,
    ];

    const productList = possibleProductLists.find(
      (item) => Array.isArray(item)
    );

    setProducts(productList ?? []);
  } catch (err: unknown) {
    if (handleAuthError(err)) return;

    console.error("Failed to load products:", err);
    setProducts([]);
  }
};


  const openNewOrder = async () => {
    setNotice("");
    setError("");
    setNewOrderOpen(true);
    await loadProducts();
  };

  // Load transaction history and calculate the payment summary.
  const loadPaymentHistory = async (orderId: number, orderTotal: number) => {
    setLoadingPayments(true);
    try {
      const response = await api.get(`/admin/orders/${orderId}/payments`, {
        params: { per_page: 100 },
      });
      const result = response.data;
      const transactions: PaymentTransaction[] = Array.isArray(result)
        ? result
        : result?.data?.data ?? result?.data ?? result?.payments?.data ?? result?.payments ?? [];
      setPaymentTransactions(transactions);

      const grossPayments = transactions
        .filter((item) => item.type === "payment")
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const totalRefunds = transactions
        .filter((item) => item.type === "refund")
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const netPaid = grossPayments - totalRefunds;
      let paymentStatus = "unpaid";
      if (grossPayments > 0 && netPaid <= 0) paymentStatus = "refunded";
      else if (netPaid >= orderTotal && orderTotal > 0) paymentStatus = "paid";
      else if (netPaid > 0) paymentStatus = "partially_paid";

      setPaymentSummary({
        gross_payments: grossPayments,
        total_refunds: totalRefunds,
        net_paid: netPaid,
        outstanding_balance: Math.max(0, orderTotal - netPaid),
        payment_status: paymentStatus,
      });
    } catch (err: unknown) {
      const errorData = isAxiosError(err) ? err.response?.data : undefined;
      if (handleAuthError(err)) return;
      setPaymentTransactions([]);
      setError(errorData?.message || "Unable to load payment history.");
    } finally {
      setLoadingPayments(false);
    }
  };

  // Open order details
  const openOrder = async (order: Order) => {
    setError("");
    try {
      const response = await api.get(`/admin/orders/${order.id}`);
      const fullOrder = response.data.order ?? response.data;
      setSelectedOrder(fullOrder);
      setStatusUpdate(fullOrder.status);
      setCancellationReason("");
      setTransactionType("payment");
      setTransactionAmount("");
      setTransactionMethod("Mobile Money");
      setTransactionReference("");
      setTransactionDate(new Date().toISOString().slice(0, 10));
      setTransactionNotes("");
      await loadPaymentHistory(fullOrder.id, Number(fullOrder.total));
    } catch (err: unknown) {
      const errorData = isAxiosError(err) ? err.response?.data : undefined;
      if (handleAuthError(err)) return;
      setError(errorData?.message || "Unable to load order details.");
    }
  };

  // Update order status
  const saveOrderStatus = async () => {
    if (!selectedOrder || !statusUpdate) return;

    if (
      statusUpdate === "cancelled" &&
      !cancellationReason.trim()
    ) {
      setError("Please provide a cancellation reason.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await api.patch(`/admin/orders/${selectedOrder.id}`, {
        status: statusUpdate,
        ...(statusUpdate === "cancelled"
          ? { cancellation_reason: cancellationReason }
          : {}),
      });

      setNotice("Order status updated successfully.");
      await loadOrders();
      await openOrder(selectedOrder);
    } catch (err: unknown) {
      const errorData = isAxiosError(err) ? err.response?.data : undefined;
      if (handleAuthError(err)) return;

      setError(
        errorData?.message ||
          errorData?.errors?.status?.[0] ||
          "Unable to update order status."
      );
    } finally {
      setSaving(false);
    }
  };

  // Record a payment or refund transaction.
  const savePayment = async () => {
    if (!selectedOrder) return;
    const amount = Number(transactionAmount);
    if (!transactionAmount || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid transaction amount.");
      return;
    }
    if (transactionType === "payment" && !transactionMethod.trim()) {
      setError("Enter the payment method.");
      return;
    }
    if (transactionType === "payment" && amount > paymentSummary.outstanding_balance) {
      setError("The payment cannot exceed the outstanding balance.");
      return;
    }
    if (transactionType === "refund" && amount > paymentSummary.net_paid) {
      setError("The refund cannot exceed the net amount paid.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post(`/admin/orders/${selectedOrder.id}/payments`, {
        type: transactionType,
        amount,
        payment_method: transactionType === "payment" ? transactionMethod : null,
        reference: transactionReference || null,
        transaction_date: transactionDate || null,
        notes: transactionNotes || null,
      });
      const result = response.data;
      setNotice(transactionType === "payment" ? "Payment recorded successfully." : "Refund recorded successfully.");
      setTransactionAmount("");
      setTransactionReference("");
      setTransactionNotes("");
      await loadOrders();
      await openOrder(selectedOrder);
      if (result.payment_status) {
        setPaymentSummary({
          gross_payments: Number(result.gross_payments ?? 0),
          total_refunds: Number(result.total_refunds ?? 0),
          net_paid: Number(result.net_paid ?? 0),
          outstanding_balance: Number(result.outstanding_balance ?? 0),
          payment_status: result.payment_status,
        });
      }
    } catch (err: unknown) {
      const errorData = isAxiosError(err) ? err.response?.data : undefined;
      if (handleAuthError(err)) return;
      const errors = errorData?.errors;
      setError(errors ? Object.values(errors).flat().join(" ") : errorData?.message || "Unable to record the transaction.");
    } finally {
      setSaving(false);
    }
  };

  // Create manual order
  const submitManualOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await api.post("/admin/orders", {
        ...newOrder,
        delivery_fee: Number(newOrder.delivery_fee),
        items: newOrder.items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
      });

      setNewOrderOpen(false);
      setNewOrder({
        customer_name: "",
        customer_phone: "",
        customer_email: "",
        delivery_address: "",
        delivery_location: "",
        delivery_fee: "0",
        customer_notes: "",
        admin_notes: "",
        items: [{ product_id: "", quantity: 1 }],
      });

      setPage(1);
      setNotice("Manual order created successfully.");
      await loadOrders();
    } catch (err: unknown) {
      const errorData = isAxiosError(err) ? err.response?.data : undefined;
      if (handleAuthError(err)) return;

      const errors = errorData?.errors;
      setError(
        errors
          ? Object.values(errors).flat().join(" ")
          : errorData?.message ||
              "Unable to create manual order."
      );
    } finally {
      setSaving(false);
    }
  };

  const updateNewOrderItem = (
    index: number,
    field: keyof NewOrderItem,
    value: string | number
  ) => {
    setNewOrder((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      ),
    }));
  };

  const addNewOrderItem = () => {
    setNewOrder((current) => ({
      ...current,
      items: [...current.items, { product_id: "", quantity: 1 }],
    }));
  };

  const removeNewOrderItem = (index: number) => {
    setNewOrder((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <>
      <div className="min-h-screen bg-[#f8f5f1] text-[#49352f]">
        <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">
          {/* Page heading */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
            <div>
              <p className="text-sm text-[#a66c72] font-medium">
                Store management
              </p>
              <h1 className="text-3xl md:text-4xl font-serif mt-2">
                Orders
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                Manage customer purchases, fulfilment and payments.
              </p>
            </div>

            <button
              onClick={openNewOrder}
              className="rounded-xl bg-[#49352f] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#35251f] transition"
            >
              + Create Manual Order
            </button>
          </div>

          {/* Notifications */}
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
              {error}
              <button
                onClick={() => setError("")}
                className="float-right font-bold"
              >
                ×
              </button>
            </div>
          )}

          {notice && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-700">
              {notice}
              <button
                onClick={() => setNotice("")}
                className="float-right font-bold"
              >
                ×
              </button>
            </div>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {[
              {
                title: "Total Orders",
                value: statistics?.total_orders ?? 0,
                note: "All recorded orders",
                icon: "▣",
              },
              {
                title: "Awaiting Confirmation",
                value: statistics?.awaiting_confirmation ?? 0,
                note: "Require your attention",
                icon: "◷",
              },
              {
                title: "Processing",
                value:
                  (statistics?.processing ?? 0) +
                  (statistics?.ready_for_delivery ?? 0),
                note: "Being prepared for delivery",
                icon: "◇",
              },
              {
                title: "Completed Revenue",
                value: formatMoney(statistics?.total_revenue ?? 0),
                note: "Revenue from completed orders",
                icon: "₵",
              },
            ].map((stat) => (
              <div
                key={stat.title}
                className="bg-white rounded-2xl border border-[#eee5df] p-6 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">{stat.title}</p>
                  <span className="h-10 w-10 rounded-xl bg-[#f6e9e7] flex items-center justify-center text-[#a66c72] text-lg">
                    {stat.icon}
                  </span>
                </div>
                <h3 className="text-2xl font-semibold mt-5">
                  {stat.value}
                </h3>
                <p className="text-xs text-gray-400 mt-2">{stat.note}</p>
              </div>
            ))}
          </div>

          {/* Order status overview */}
          <div className="bg-white rounded-2xl border border-[#eee5df] p-6 mt-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="font-serif text-xl">Order Progress</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Overview of your order pipeline
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {statistics?.total_orders ?? 0} total orders
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                ["Confirmed", statistics?.confirmed ?? 0],
                ["Processing", statistics?.processing ?? 0],
                ["Ready", statistics?.ready_for_delivery ?? 0],
                ["Dispatched", statistics?.out_for_delivery ?? 0],
                ["Completed", statistics?.completed ?? 0],
                ["Cancelled", statistics?.cancelled ?? 0],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-[#faf7f4] p-4"
                >
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-semibold mt-2">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Orders table */}
          <div className="bg-white rounded-2xl border border-[#eee5df] shadow-sm mt-6 overflow-hidden">
            <div className="p-6 border-b border-[#f0eae5]">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="font-serif text-xl">All Orders</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Search, filter and manage customer orders
                  </p>
                </div>

                <button
                  onClick={loadOrders}
                  disabled={loading}
                  className="rounded-xl border border-[#e8dcd5] px-4 py-2.5 text-sm text-[#765c56] hover:bg-[#faf7f4] disabled:opacity-50"
                >
                  ↻ Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search order, customer or phone..."
                  className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72] bg-white"
                >
                  <option value="">All order statuses</option>
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>

                <select
                  value={sourceFilter}
                  onChange={(event) => {
                    setSourceFilter(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72] bg-white"
                >
                  <option value="">All order sources</option>
                  <option value="website">Website</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center">
                <div className="h-8 w-8 rounded-full border-4 border-[#ead5d0] border-t-[#9c686b] animate-spin mx-auto" />
                <p className="text-sm text-gray-400 mt-4">
                  Loading orders...
                </p>
              </div>
            ) : orders.length === 0 ? (
              <div className="p-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-[#f8f0ed] flex items-center justify-center text-2xl text-[#a66c72]">
                  ▣
                </div>
                <h4 className="font-medium mt-4">No orders found</h4>
                <p className="text-sm text-gray-400 mt-2">
                  Orders matching your search will appear here.
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                    setSourceFilter("");
                    setPage(1);
                  }}
                  className="mt-5 text-sm font-medium text-[#a66c72] hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left">
                    <thead className="bg-[#faf7f4] text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="px-6 py-4 font-medium">Order</th>
                        <th className="px-6 py-4 font-medium">Customer</th>
                        <th className="px-6 py-4 font-medium">Date</th>
                        <th className="px-6 py-4 font-medium">Total</th>
                        <th className="px-6 py-4 font-medium">Payment</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Source</th>
                        <th className="px-6 py-4 font-medium">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#f0eae5]">
                      {orders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-[#fdfbf9] transition"
                        >
                          <td className="px-6 py-5">
                            <p className="text-sm font-semibold">
                              {order.order_number}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {order.items?.length ?? 0} product(s)
                            </p>
                          </td>

                          <td className="px-6 py-5">
                            <p className="text-sm font-medium">
                              {order.customer_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {order.customer_phone}
                            </p>
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-500">
                            {formatDate(order.created_at)}
                          </td>

                          <td className="px-6 py-5 text-sm font-semibold">
                            {formatMoney(order.total)}
                          </td>

                          <td className="px-6 py-5">
                            <span className="text-xs font-medium capitalize">
                              {formatStatus(order.payment_status)}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${statusStyle(order.status)}`}
                            >
                              {formatStatus(order.status)}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <span className="text-xs capitalize text-gray-500">
                              {order.source}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <button
                              onClick={() => openOrder(order)}
                              className="rounded-lg border border-[#e8dcd5] px-3 py-2 text-xs font-medium text-[#765c56] hover:bg-[#f8f0ed] transition"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-5 border-t border-[#f0eae5] flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-gray-400">
                    Showing page {pagination.current_page} of{" "}
                    {pagination.last_page} · {pagination.total} orders
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={pagination.current_page <= 1}
                      onClick={() => setPage((current) => current - 1)}
                      className="rounded-lg border border-[#e8dcd5] px-4 py-2 text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <button
                      disabled={
                        pagination.current_page >= pagination.last_page
                      }
                      onClick={() => setPage((current) => current + 1)}
                      className="rounded-lg border border-[#e8dcd5] px-4 py-2 text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <footer className="text-center text-xs text-gray-400 py-8">
            © {new Date().getFullYear()} BigFred. Admin Workspace.
          </footer>
        </div>
      </div>

      {/* Order details modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 md:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedOrder(null);
            }
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-[#eee5df] p-6 flex items-center justify-between z-10">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#a66c72]">
                  Order details
                </p>
                <h3 className="font-serif text-xl mt-1">
                  {selectedOrder.order_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="h-9 w-9 rounded-full bg-[#f8f5f1] text-xl hover:bg-[#ead5d0]"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-7">
              {/* Customer information */}
              <div>
                <h4 className="font-semibold mb-3">Customer information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-[#faf7f4] p-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Customer</p>
                    <p className="font-medium mt-1">
                      {selectedOrder.customer_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="font-medium mt-1">
                      {selectedOrder.customer_phone}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="font-medium mt-1">
                      {selectedOrder.customer_email || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Order source</p>
                    <p className="font-medium mt-1 capitalize">
                      {selectedOrder.source}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-400">Delivery address</p>
                    <p className="font-medium mt-1">
                      {selectedOrder.delivery_address}
                    </p>
                    {selectedOrder.delivery_location && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedOrder.delivery_location}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Ordered products */}
              <div>
                <h4 className="font-semibold mb-3">Products ordered</h4>
                <div className="border border-[#eee5df] rounded-xl overflow-hidden">
                  {selectedOrder.items?.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex items-center justify-between gap-4 border-b last:border-0 border-[#eee5df]"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Quantity: {item.quantity}
                          {item.product_sku ? ` · SKU: ${item.product_sku}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatMoney(item.line_total)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatMoney(item.unit_price)} each
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatMoney(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivery fee</span>
                    <span>{formatMoney(selectedOrder.delivery_fee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#eee5df] pt-3 font-semibold text-base">
                    <span>Total</span>
                    <span>{formatMoney(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              {/* Order notes */}
              {(selectedOrder.customer_notes ||
                selectedOrder.admin_notes ||
                selectedOrder.cancellation_reason) && (
                <div>
                  <h4 className="font-semibold mb-3">Order notes</h4>
                  <div className="rounded-xl bg-[#faf7f4] p-4 space-y-3 text-sm">
                    {selectedOrder.customer_notes && (
                      <div>
                        <p className="text-xs text-gray-400">
                          Customer notes
                        </p>
                        <p className="mt-1">
                          {selectedOrder.customer_notes}
                        </p>
                      </div>
                    )}
                    {selectedOrder.admin_notes && (
                      <div>
                        <p className="text-xs text-gray-400">Admin notes</p>
                        <p className="mt-1">{selectedOrder.admin_notes}</p>
                      </div>
                    )}
                    {selectedOrder.cancellation_reason && (
                      <div>
                        <p className="text-xs text-red-500">
                          Cancellation reason
                        </p>
                        <p className="mt-1">
                          {selectedOrder.cancellation_reason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Update order status */}
              <div className="border-t border-[#eee5df] pt-6">
                <h4 className="font-semibold mb-3">Update order status</h4>

                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={statusUpdate}
                    onChange={(event) => setStatusUpdate(event.target.value)}
                    className="flex-1 rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm bg-white outline-none focus:border-[#a66c72]"
                  >
                    {orderStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={saveOrderStatus}
                    disabled={saving || statusUpdate === selectedOrder.status}
                    className="rounded-xl bg-[#49352f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#35251f] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Update Status"}
                  </button>
                </div>

                {statusUpdate === "cancelled" &&
                  selectedOrder.status !== "cancelled" && (
                    <textarea
                      value={cancellationReason}
                      onChange={(event) =>
                        setCancellationReason(event.target.value)
                      }
                      rows={3}
                      placeholder="Enter the reason for cancelling this order..."
                      className="mt-3 w-full rounded-xl border border-red-200 px-4 py-3 text-sm outline-none focus:border-red-400"
                    />
                  )}

                <p className="text-xs text-gray-400 mt-2">
                  Status changes follow the order workflow rules configured
                  in your backend.
                </p>

                {selectedOrder.restock_status && (
                  <p className="text-xs text-gray-500 mt-2">
                    Inventory restoration:{" "}
                    <strong>
                      {formatStatus(selectedOrder.restock_status)}
                    </strong>
                  </p>
                )}
              </div>

              {/* Payment transactions */}
              <div className="border-t border-[#eee5df] pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="font-semibold">Payment information</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Record payments and refunds. Payment status is calculated automatically.
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                    paymentSummary.payment_status === "paid" ? "bg-green-50 text-green-700" :
                    paymentSummary.payment_status === "refunded" ? "bg-red-50 text-red-700" :
                    paymentSummary.payment_status === "partially_paid" ? "bg-amber-50 text-amber-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {formatStatus(paymentSummary.payment_status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Order total", value: Number(selectedOrder.total) },
                    { label: "Payments received", value: paymentSummary.gross_payments },
                    { label: "Refunds", value: paymentSummary.total_refunds },
                    { label: "Outstanding", value: paymentSummary.outstanding_balance },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-[#faf7f4] p-3">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="text-sm sm:text-base font-semibold mt-2">{formatMoney(item.value)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h5 className="text-sm font-semibold">Transaction history</h5>
                    <span className="text-xs text-gray-400">Net paid: {formatMoney(paymentSummary.net_paid)}</span>
                  </div>
                  {loadingPayments ? (
                    <div className="rounded-xl bg-[#faf7f4] p-6 text-center text-sm text-gray-500">Loading payment history...</div>
                  ) : paymentTransactions.length === 0 ? (
                    <div className="rounded-xl bg-[#faf7f4] p-6 text-center">
                      <p className="text-sm font-medium text-gray-600">No transactions recorded</p>
                      <p className="text-xs text-gray-400 mt-1">Payments and refunds will appear here once recorded.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paymentTransactions.map((transaction) => (
                        <div key={transaction.id} className="rounded-xl border border-[#eee5df] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${transaction.type === "payment" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                {transaction.type === "payment" ? "Payment received" : "Refund issued"}
                              </span>
                              <p className="text-xs text-gray-500 mt-2">{formatDate(transaction.transaction_date || transaction.created_at)}</p>
                            </div>
                            <p className={`font-semibold ${transaction.type === "payment" ? "text-green-700" : "text-red-600"}`}>
                              {transaction.type === "refund" ? "−" : "+"}{formatMoney(transaction.amount)}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
                            {transaction.payment_method && <p>Method: <span className="text-gray-700">{transaction.payment_method}</span></p>}
                            {transaction.reference && <p>Reference: <span className="text-gray-700">{transaction.reference}</span></p>}
                            {transaction.recorder?.name && <p>Recorded by: <span className="text-gray-700">{transaction.recorder.name}</span></p>}
                            {transaction.notes && <p className="sm:col-span-2">Notes: <span className="text-gray-700">{transaction.notes}</span></p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-xl border border-[#eee5df] p-4 sm:p-5">
                  <h5 className="font-semibold mb-1">Record a transaction</h5>
                  <p className="text-xs text-gray-400 mb-4">Enter the amount received or refunded. Payment status updates automatically.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Transaction type</label>
                      <select value={transactionType} onChange={(event) => setTransactionType(event.target.value as "payment" | "refund")} className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm bg-white outline-none focus:border-[#a66c72]">
                        <option value="payment">Payment received</option>
                        <option value="refund">Refund issued</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Amount (GH₵)</label>
                      <input required type="number" min="0.01" max={transactionType === "payment" ? paymentSummary.outstanding_balance : paymentSummary.net_paid} step="0.01" value={transactionAmount} onChange={(event) => setTransactionAmount(event.target.value)} placeholder="0.00" className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]" />
                      <p className="text-[11px] text-gray-400 mt-1">Maximum: {formatMoney(transactionType === "payment" ? paymentSummary.outstanding_balance : paymentSummary.net_paid)}</p>
                    </div>
                    {transactionType === "payment" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Payment method</label>
                        <select value={transactionMethod} onChange={(event) => setTransactionMethod(event.target.value)} className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm bg-white outline-none focus:border-[#a66c72]">
                          <option value="Mobile Money">Mobile Money</option><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="Other">Other</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Transaction date</label>
                      <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Reference (optional)</label>
                      <input value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} placeholder="Transaction ID, receipt number..." className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes (optional)</label>
                      <textarea rows={2} value={transactionNotes} onChange={(event) => setTransactionNotes(event.target.value)} placeholder="Add any relevant payment or refund notes..." className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]" />
                    </div>
                  </div>
                  <button onClick={savePayment} disabled={saving || !transactionAmount || Number(transactionAmount) <= 0 || (transactionType === "payment" ? paymentSummary.outstanding_balance <= 0 || Number(transactionAmount) > paymentSummary.outstanding_balance : paymentSummary.net_paid <= 0 || Number(transactionAmount) > paymentSummary.net_paid)} className="mt-4 w-full sm:w-auto rounded-xl bg-[#49352f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#35251f] disabled:opacity-50">
                    {saving ? "Saving..." : transactionType === "payment" ? "Record Payment" : "Record Refund"}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                Created: {formatDate(selectedOrder.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create manual order modal */}
      {newOrderOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 md:p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-[#eee5df] p-6 flex items-center justify-between z-10">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#a66c72]">
                  Store management
                </p>
                <h3 className="font-serif text-xl mt-1">
                  Create Manual Order
                </h3>
              </div>
              <button
                onClick={() => setNewOrderOpen(false)}
                className="h-9 w-9 rounded-full bg-[#f8f5f1] text-xl hover:bg-[#ead5d0]"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitManualOrder} className="p-6 space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Customer details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    required
                    value={newOrder.customer_name}
                    onChange={(event) =>
                      setNewOrder({
                        ...newOrder,
                        customer_name: event.target.value,
                      })
                    }
                    placeholder="Customer full name"
                    className="rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                  />

                  <input
                    required
                    value={newOrder.customer_phone}
                    onChange={(event) =>
                      setNewOrder({
                        ...newOrder,
                        customer_phone: event.target.value,
                      })
                    }
                    placeholder="Phone number"
                    className="rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                  />

                  <input
                    type="email"
                    value={newOrder.customer_email}
                    onChange={(event) =>
                      setNewOrder({
                        ...newOrder,
                        customer_email: event.target.value,
                      })
                    }
                    placeholder="Email address (optional)"
                    className="rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                  />

                  <input
                    value={newOrder.delivery_location}
                    onChange={(event) =>
                      setNewOrder({
                        ...newOrder,
                        delivery_location: event.target.value,
                      })
                    }
                    placeholder="Town / area"
                    className="rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                  />

                  <textarea
                    required
                    rows={2}
                    value={newOrder.delivery_address}
                    onChange={(event) =>
                      setNewOrder({
                        ...newOrder,
                        delivery_address: event.target.value,
                      })
                    }
                    placeholder="Full delivery address"
                    className="sm:col-span-2 rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                  />
                </div>
              </div>

              {/* Products */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Order products</h4>
                  <button
                    type="button"
                    onClick={addNewOrderItem}
                    className="text-sm font-semibold text-[#a66c72] hover:underline"
                  >
                    + Add product
                  </button>
                </div>

                <div className="space-y-3">
                  {newOrder.items.map((item, index) => {
                    const selectedProduct = products.find(
                      (product) =>
                        product.id === Number(item.product_id)
                    );

                    return (
                      <div
                        key={index}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_110px_auto] gap-3 rounded-xl bg-[#faf7f4] p-3"
                      >
                        <div>
                          <select
                            required
                            value={item.product_id}
                            onChange={(event) =>
                              updateNewOrderItem(
                                index,
                                "product_id",
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[#e8dcd5] bg-white px-3 py-3 text-sm outline-none focus:border-[#a66c72]"
                          >
                            <option value="">Select a product</option>
                            {products.map((product) => (
                              <option
                                key={product.id}
                                value={product.id}
                                disabled={product.stock_quantity < 1}
                              >
                                {product.name} —{" "}
                                {formatMoney(product.price)} · Stock:{" "}
                                {product.stock_quantity}
                              </option>
                            ))}
                          </select>

                          {selectedProduct && (
                            <p className="text-xs text-gray-500 mt-2">
                              {formatMoney(selectedProduct.price)} per unit
                            </p>
                          )}
                        </div>

                        <input
                          required
                          type="number"
                          min={1}
                          max={selectedProduct?.stock_quantity ?? 100}
                          value={item.quantity}
                          onChange={(event) =>
                            updateNewOrderItem(
                              index,
                              "quantity",
                              Number(event.target.value)
                            )
                          }
                          className="w-full rounded-lg border border-[#e8dcd5] px-3 py-3 text-sm outline-none focus:border-[#a66c72]"
                          placeholder="Quantity"
                        />

                        <button
                          type="button"
                          disabled={newOrder.items.length === 1}
                          onClick={() => removeNewOrderItem(index)}
                          className="rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-30"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>

                {products.length === 0 && (
                  <p className="text-xs text-amber-700 mt-3">
                    No products were loaded. Check that products exist and
                    that the admin products endpoint is available.
                  </p>
                )}
              </div>

              {/* Delivery and notes */}
              <div>
                <h4 className="font-semibold mb-3">Delivery and notes</h4>
                <div className="space-y-3">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={newOrder.delivery_fee}
                    onChange={(event) =>
                      setNewOrder({
                        ...newOrder,
                        delivery_fee: event.target.value,
                      })
                    }
                    placeholder="Delivery fee (GH₵)"
                    className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                  />

                  <textarea
                    rows={2}
                    value={newOrder.customer_notes}
                    onChange={(event) =>
                      setNewOrder({
                        ...newOrder,
                        customer_notes: event.target.value,
                      })
                    }
                    placeholder="Customer notes (optional)"
                    className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                  />

                  <textarea
                    rows={2}
                    value={newOrder.admin_notes}
                    onChange={(event) =>
                      setNewOrder({
                        ...newOrder,
                        admin_notes: event.target.value,
                      })
                    }
                    placeholder="Internal admin notes (optional)"
                    className="w-full rounded-xl border border-[#e8dcd5] px-4 py-3 text-sm outline-none focus:border-[#a66c72]"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-[#f8f0ed] p-4">
                <p className="text-sm font-medium">
                  Manual orders are created as confirmed orders.
                </p>
                <p className="text-xs text-[#765c56] mt-1">
                  Inventory will be deducted automatically when the order is
                  created.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-[#eee5df] pt-5">
                <button
                  type="button"
                  onClick={() => setNewOrderOpen(false)}
                  className="rounded-xl border border-[#e8dcd5] px-6 py-3 text-sm font-medium hover:bg-[#faf7f4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    products.length === 0 ||
                    newOrder.items.some((item) => !item.product_id)
                  }
                  className="rounded-xl bg-[#49352f] px-6 py-3 text-sm font-semibold text-white hover:bg-[#35251f] disabled:opacity-50"
                >
                  {saving ? "Creating order..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
