
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api, { initializeCsrf } from "@/lib/api";

type Customer = {
  id: number;
  name: string;
  email: string;
};

type OrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string | null;
  unit_price: string | number;
  quantity: number;
  line_total: string | number;
};

type CustomerOrder = {
  id: number;
  order_number: string;
  customer_name: string;
  status: string;
  subtotal: string | number;
  delivery_fee: string | number;
  total: string | number;
  payment_status: string;
  delivery_address: string;
  delivery_location: string | null;
  customer_notes: string | null;
  created_at: string;
  items: OrderItem[];
};

type PaginatedOrders = {
  current_page: number;
  data: CustomerOrder[];
  last_page: number;
  total: number;
};

const formatCurrency = (amount: string | number) => {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatStatus = (status: string) => {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
    case "delivered":
      return "bg-green-50 text-green-700";

    case "cancelled":
    case "rejected":
      return "bg-red-50 text-red-700";

    case "awaiting_confirmation":
      return "bg-amber-50 text-amber-700";

    case "confirmed":
    case "processing":
      return "bg-blue-50 text-blue-700";

    case "shipped":
    case "out_for_delivery":
      return "bg-purple-50 text-purple-700";

    default:
      return "bg-[#f3e9e4] text-[#8d6b60]";
  }
};

export default function AccountPage() {
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [orderCount, setOrderCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [ordersError, setOrdersError] = useState("");

  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(
    null
  );

  useEffect(() => {
    let active = true;

    const loadAccount = async () => {
      try {
        const response = await api.get("/customer/me");

        if (!active) return;

        const customerData = response.data.customer;
        setCustomer(customerData);
        setLoading(false);

        try {
          const ordersResponse = await api.get("/customer/orders");

          if (!active) return;

          const pagination: PaginatedOrders =
            ordersResponse.data.data;

          setOrders(pagination.data || []);
          setOrderCount(pagination.total || 0);
        } catch (orderError: any) {
          if (active) {
            if (orderError.response?.status === 401) {
              router.replace("/login");
            } else {
              setOrdersError(
                "We couldn't load your order history. Please try again."
              );
            }
          }
        } finally {
          if (active) {
            setOrdersLoading(false);
          }
        }
      } catch (err: any) {
        if (active) {
          if (err.response?.status === 401) {
            router.replace("/login");
          } else {
            setError(
              "We couldn't load your account. Please try again."
            );
          }

          setLoading(false);
          setOrdersLoading(false);
        }
      }
    };

    loadAccount();

    return () => {
      active = false;
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await initializeCsrf();
      await api.post("/customer/logout");
      router.replace("/login");
    } catch {
      setError("We couldn't sign you out. Please try again.");
      setLoggingOut(false);
    }
  };

  const toggleOrder = (orderId: number) => {
    setExpandedOrderId((current) =>
      current === orderId ? null : orderId
    );
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f4f0]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#ead5cf] border-t-[#49332b]" />
          <p className="mt-4 text-sm text-[#806b61]">
            Preparing your BigFred experience...
          </p>
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f4f0] px-6">
        <div className="text-center">
          <h1 className="font-serif text-3xl text-[#49332b]">
            Your account
          </h1>
          <p className="mt-3 text-sm text-[#806b61]">
            {error || "Please sign in to continue."}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-xl bg-[#49332b] px-7 py-3 text-sm text-white"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  const firstName = customer.name.trim().split(" ")[0];

  const initials = customer.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="min-h-screen bg-[#f8f4f0] text-[#49332b]">

      {/* TOP NAVIGATION */}
      <header className="border-b border-[#eadfd8] bg-[#fffdfa]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">

          <Link href="/" className="group">
            <span className="font-serif text-3xl font-bold tracking-tight">
              BigFred<span className="text-[#b47e70]">.</span>
            </span>
            <span className="mt-0.5 block text-[9px] tracking-[0.28em] text-[#967b70]">
              BEAUTY & LIFESTYLE
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-[#806b61] md:flex">
            <Link href="/" className="transition hover:text-[#49332b]">
              Home
            </Link>
            <Link href="/#shop" className="transition hover:text-[#49332b]">
              Shop
            </Link>
            <span className="font-semibold text-[#49332b]">
              My Account
            </span>
          </nav>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-full border border-[#dfcec5] px-5 py-2.5 text-xs font-semibold text-[#72564b] transition hover:bg-[#ead5cf] disabled:opacity-50"
          >
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>

        </div>
      </header>

      {/* PAGE CONTENT */}
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">

        {/* WELCOME */}
        <section className="relative overflow-hidden rounded-[24px] bg-[#ead5cf] px-7 py-10 sm:px-12 sm:py-14">
          <div className="relative z-10 max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#987267]">
              YOUR PERSONAL SPACE
            </p>

            <h1 className="mt-4 font-serif text-4xl leading-tight text-[#49332b] sm:text-5xl">
              Welcome back, {firstName}.
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-7 text-[#765f55]">
              Your beauty journey, all in one place. Manage your
              personal details, keep track of your orders and enjoy
              a more personal BigFred experience.
            </p>

            <Link
              href="/#shop"
              className="mt-7 inline-flex rounded-xl bg-[#49332b] px-7 py-3.5 text-xs font-semibold text-white transition hover:bg-[#65483d]"
            >
              Explore the collection
            </Link>
          </div>

          <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full border border-white/30" />
          <div className="pointer-events-none absolute -right-4 -top-12 h-64 w-64 rounded-full border border-white/30" />
        </section>

        {/* DASHBOARD GRID */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">

          {/* SIDEBAR */}
          <aside className="h-fit rounded-[20px] border border-[#eee3dc] bg-[#fffdfa] p-6 shadow-sm">

            <div className="flex items-center gap-4 border-b border-[#eee3dc] pb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ead5cf] font-serif text-xl font-semibold text-[#65483d]">
                {initials}
              </div>

              <div className="min-w-0">
                <p className="truncate font-semibold text-[#49332b]">
                  {customer.name}
                </p>
                <p className="mt-1 truncate text-xs text-[#927d73]">
                  {customer.email}
                </p>
              </div>
            </div>

            <p className="mb-3 mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#aa8b7e]">
              MY ACCOUNT
            </p>

            <nav className="space-y-2 text-sm">
              <a
                href="#overview"
                className="flex items-center gap-3 rounded-xl bg-[#f4e8e3] px-4 py-3 font-semibold text-[#65483d]"
              >
                <span>⌂</span>
                Overview
              </a>

              <a
                href="#profile"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#806b61] transition hover:bg-[#faf3ef]"
              >
                <span>♙</span>
                My Profile
              </a>

              <a
                href="#orders"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#806b61] transition hover:bg-[#faf3ef]"
              >
                <span>▤</span>
                My Orders
              </a>

              <a
                href="#delivery"
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-[#806b61] transition hover:bg-[#faf3ef]"
              >
                <span>⌖</span>
                Delivery Details
              </a>
            </nav>

            <div className="mt-8 rounded-xl bg-[#f8f1ed] p-4">
              <p className="font-serif text-lg text-[#65483d]">
                A little self-care goes a long way.
              </p>
              <p className="mt-2 text-xs leading-5 text-[#927d73]">
                Thank you for being part of the BigFred family.
              </p>
            </div>

          </aside>

          {/* MAIN DASHBOARD */}
          <div className="min-w-0 space-y-8" id="overview">

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#a47c70]">
                ACCOUNT OVERVIEW
              </p>
              <h2 className="mt-2 font-serif text-3xl text-[#49332b]">
                Your dashboard
              </h2>
              <p className="mt-2 text-sm text-[#927d73]">
                Everything you need to manage your BigFred account.
              </p>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

              <div className="rounded-[18px] border border-[#eee3dc] bg-[#fffdfa] p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e5df] text-xl">
                  ♙
                </div>
                <p className="mt-5 text-xs text-[#927d73]">
                  Account Holder
                </p>
                <p className="mt-1 font-serif text-xl text-[#49332b]">
                  {customer.name}
                </p>
              </div>

              <div className="rounded-[18px] border border-[#eee3dc] bg-[#fffdfa] p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e5df] text-xl">
                  ▤
                </div>
                <p className="mt-5 text-xs text-[#927d73]">
                  Order History
                </p>
                <p className="mt-1 font-serif text-xl text-[#49332b]">
                  {ordersLoading ? "Loading..." : orderCount}
                </p>
                <p className="mt-1 text-[11px] text-[#a18e85]">
                  {orderCount === 1 ? "Order placed" : "Orders placed"}
                </p>
              </div>

              <div className="rounded-[18px] border border-[#eee3dc] bg-[#fffdfa] p-6 shadow-sm sm:col-span-2 xl:col-span-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e5df] text-xl">
                  ♡
                </div>
                <p className="mt-5 text-xs text-[#927d73]">
                  Your BigFred Account
                </p>
                <p className="mt-1 font-serif text-xl text-[#49332b]">
                  Active
                </p>
              </div>

            </div>

            {/* PROFILE */}
            <section
              id="profile"
              className="scroll-mt-8 rounded-[20px] border border-[#eee3dc] bg-[#fffdfa] p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a47c70]">
                    PERSONAL INFORMATION
                  </p>
                  <h3 className="mt-2 font-serif text-2xl">
                    My Profile
                  </h3>
                </div>
                <span className="rounded-full bg-[#f3e9e4] px-4 py-2 text-[10px] font-semibold text-[#8d6b60]">
                  CUSTOMER ACCOUNT
                </span>
              </div>

              <div className="mt-7 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[#a18e85]">Full Name</p>
                  <p className="mt-2 text-sm font-medium text-[#49332b]">
                    {customer.name}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#a18e85]">Email Address</p>
                  <p className="mt-2 break-all text-sm font-medium text-[#49332b]">
                    {customer.email}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#a18e85]">Account Number</p>
                  <p className="mt-2 text-sm font-medium text-[#49332b]">
                    BF-{String(customer.id).padStart(5, "0")}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#a18e85]">Account Type</p>
                  <p className="mt-2 text-sm font-medium text-[#49332b]">
                    BigFred Customer
                  </p>
                </div>
              </div>

              <p className="mt-7 border-t border-[#eee3dc] pt-5 text-xs text-[#a18e85]">
                Profile editing will be available in the next account update.
              </p>
            </section>

            {/* ORDERS */}
            <section
              id="orders"
              className="scroll-mt-8 rounded-[20px] border border-[#eee3dc] bg-[#fffdfa] p-6 shadow-sm sm:p-8"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a47c70]">
                YOUR PURCHASES
              </p>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-2xl">
                  My Orders
                </h3>
                <span className="text-xs text-[#a18e85]">
                  {orderCount} {orderCount === 1 ? "order" : "orders"}
                </span>
              </div>

              {/* ORDER LOADING */}
              {ordersLoading && (
                <div className="mt-6 rounded-xl bg-[#f9f3ef] px-5 py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#ead5cf] border-t-[#49332b]" />
                  <p className="mt-4 text-xs text-[#927d73]">
                    Loading your orders...
                  </p>
                </div>
              )}

              {/* ORDER ERROR */}
              {!ordersLoading && ordersError && (
                <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-5 py-7 text-center">
                  <p className="text-sm text-red-700">
                    {ordersError}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 rounded-lg bg-[#49332b] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#65483d]"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* EMPTY ORDERS */}
              {!ordersLoading && !ordersError && orders.length === 0 && (
                <div className="mt-6 rounded-xl bg-[#f9f3ef] px-5 py-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ead5cf] text-2xl">
                    ▤
                  </div>

                  <h4 className="mt-4 font-serif text-xl">
                    Your orders will appear here
                  </h4>

                  <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-[#927d73]">
                    You haven't placed any orders yet. Explore our collection
                    and your purchases will automatically appear here.
                  </p>

                  <Link
                    href="/#shop"
                    className="mt-5 inline-block rounded-xl bg-[#49332b] px-6 py-3 text-xs font-semibold text-white transition hover:bg-[#65483d]"
                  >
                    Start Shopping
                  </Link>
                </div>
              )}

              {/* ORDER LIST */}
              {!ordersLoading && !ordersError && orders.length > 0 && (
                <div className="mt-6 space-y-4">

                  {orders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;

                    return (
                      <div
                        key={order.id}
                        className="overflow-hidden rounded-xl border border-[#eee3dc] bg-white"
                      >

                        {/* ORDER SUMMARY */}
                        <div className="p-5 sm:p-6">
                          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#a47c70]">
                                ORDER REFERENCE
                              </p>

                              <h4 className="mt-1 font-semibold text-[#49332b]">
                                {order.order_number}
                              </h4>

                              <p className="mt-2 text-xs text-[#a18e85]">
                                Placed on {formatDate(order.created_at)}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className={`rounded-full px-3 py-2 text-[10px] font-semibold ${getStatusStyle(order.status)}`}
                              >
                                {formatStatus(order.status)}
                              </span>

                              <span className="font-serif text-lg font-semibold text-[#49332b]">
                                {formatCurrency(order.total)}
                              </span>
                            </div>

                          </div>

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0e7e1] pt-4">

                            <p className="text-xs text-[#927d73]">
                              {order.items?.length || 0}{" "}
                              {(order.items?.length || 0) === 1
                                ? "product"
                                : "products"}
                            </p>

                            <button
                              onClick={() => toggleOrder(order.id)}
                              className="rounded-lg border border-[#dfcec5] px-4 py-2.5 text-xs font-semibold text-[#72564b] transition hover:bg-[#f8f1ed]"
                            >
                              {isExpanded ? "Hide Details ↑" : "View Details ↓"}
                            </button>

                          </div>
                        </div>

                        {/* EXPANDED ORDER DETAILS */}
                        {isExpanded && (
                          <div className="border-t border-[#eee3dc] bg-[#fdf9f6] p-5 sm:p-6">

                            <h5 className="font-serif text-lg">
                              Order Details
                            </h5>

                            {/* PRODUCTS */}
                            <div className="mt-5 space-y-4">

                              {order.items?.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee3dc] pb-4"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-[#49332b]">
                                      {item.product_name}
                                    </p>

                                    {item.product_sku && (
                                      <p className="mt-1 text-[10px] text-[#a18e85]">
                                        SKU: {item.product_sku}
                                      </p>
                                    )}

                                    <p className="mt-1 text-xs text-[#927d73]">
                                      {formatCurrency(item.unit_price)} ×{" "}
                                      {item.quantity}
                                    </p>
                                  </div>

                                  <p className="text-sm font-semibold text-[#49332b]">
                                    {formatCurrency(item.line_total)}
                                  </p>
                                </div>
                              ))}

                            </div>

                            {/* TOTALS */}
                            <div className="ml-auto mt-5 max-w-xs space-y-3">

                              <div className="flex justify-between gap-5 text-xs text-[#927d73]">
                                <span>Subtotal</span>
                                <span>{formatCurrency(order.subtotal)}</span>
                              </div>

                              <div className="flex justify-between gap-5 text-xs text-[#927d73]">
                                <span>Delivery Fee</span>
                                <span>{formatCurrency(order.delivery_fee)}</span>
                              </div>

                              <div className="flex justify-between gap-5 border-t border-[#dfcec5] pt-3">
                                <span className="text-sm font-semibold">
                                  Order Total
                                </span>
                                <span className="font-serif text-lg font-bold">
                                  {formatCurrency(order.total)}
                                </span>
                              </div>

                              <div className="flex justify-between gap-5 text-xs text-[#927d73]">
                                <span>Payment Status</span>
                                <span className="font-semibold text-[#72564b]">
                                  {formatStatus(order.payment_status)}
                                </span>
                              </div>

                            </div>

                            {/* DELIVERY DETAILS */}
                            <div className="mt-6 rounded-xl border border-[#eee3dc] bg-white p-4">

                              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#a47c70]">
                                DELIVERY INFORMATION
                              </p>

                              <p className="mt-3 text-sm font-medium text-[#49332b]">
                                {order.delivery_address}
                              </p>

                              {order.delivery_location && (
                                <p className="mt-1 text-xs text-[#927d73]">
                                  {order.delivery_location}
                                </p>
                              )}

                              {order.customer_notes && (
                                <p className="mt-3 text-xs leading-5 text-[#927d73]">
                                  Note: {order.customer_notes}
                                </p>
                              )}

                            </div>

                          </div>
                        )}

                      </div>
                    );
                  })}

                </div>
              )}

            </section>

            {/* DELIVERY */}
            <section
              id="delivery"
              className="scroll-mt-8 rounded-[20px] border border-[#eee3dc] bg-[#fffdfa] p-6 shadow-sm sm:p-8"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a47c70]">
                DELIVERY PREFERENCES
              </p>

              <h3 className="mt-2 font-serif text-2xl">
                Delivery Details
              </h3>

              <div className="mt-6 rounded-xl border border-dashed border-[#dfcec5] bg-[#fdf9f6] px-5 py-7 text-center">
                <div className="text-2xl">⌖</div>

                <h4 className="mt-3 font-serif text-lg">
                  No saved delivery address yet
                </h4>

                <p className="mt-2 text-xs leading-6 text-[#927d73]">
                  Your saved delivery information will make future checkouts
                  quicker and easier.
                </p>

                <p className="mt-3 text-[10px] text-[#a18e85]">
                  Address management will be connected next.
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-10 border-t border-[#eadfd8] bg-[#fffdfa]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 py-7 text-xs text-[#927d73] sm:flex-row sm:px-8 lg:px-12">
          <p>
            © {new Date().getFullYear()} BigFred. All rights reserved.
          </p>
          <p>Beauty, confidence & lifestyle.</p>
        </div>
      </footer>

    </main>
  );
}
