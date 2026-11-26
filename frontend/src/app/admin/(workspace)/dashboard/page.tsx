
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/AdminContext";
import api from "@/lib/api";

type IconName =
  | "revenue"
  | "orders"
  | "products"
  | "customers"
  | "arrow"
  | "review"
  | "plus"
  | "folder"
  | "settings"
  | "chart"
  | "package"
  | "clock";

type Period = "7d" | "30d" | "12m";

interface ChartPoint {
  date: string;
  label: string;
  revenue: number;
  payments: number;
  refunds: number;
  orders: number;
}

interface DashboardOrderItem {
  id: number;
  product_name: string;
  quantity: number;
  line_total: string | number;
}

interface DashboardOrder {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  status: string;
  payment_status: string;
  total: string | number;
  created_at: string;
  items?: DashboardOrderItem[];
}

interface TopProduct {
  product_id: number | null;
  product_name: string;
  units_sold: number;
  sales_value: string | number;
}

interface DashboardData {
  currency: string;
  period: Period;
  summary: {
    total_revenue: number;
    gross_payments: number;
    total_refunds: number;
    total_orders: number;
    total_customers: number;
    new_customers: number;
    total_products: number;
    low_stock_products: number;
    out_of_stock_products: number;
    pending_orders: number;
    pending_reviews: number;
    total_reviews: number;
    total_categories: number;
  };
  orders: {
    statuses: Record<string, number>;
    recent: DashboardOrder[];
  };
  revenue: {
    gross_payments: number;
    refunds: number;
    net_revenue: number;
    chart: ChartPoint[];
  };
  inventory: {
    total_products: number;
    low_stock: number;
    out_of_stock: number;
    top_selling: TopProduct[];
  };
  customers: {
    total: number;
    new_in_period: number;
  };
  reviews: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    revenue: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    orders: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    products: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 16 9 5 9-5" />
      </>
    ),
    customers: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
    review: (
      <>
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    folder: (
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-5 5" />
      </>
    ),
    package: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const quickActions = [
  {
    title: "Add Product",
    description: "Add a new product to your store.",
    icon: "plus" as const,
    href: "/admin/products",
  },
  {
    title: "Manage Categories",
    description: "Organise your product collections.",
    icon: "folder" as const,
    href: "/admin/categories",
  },
  {
    title: "View Orders",
    description: "Review and manage customer orders.",
    icon: "orders" as const,
    href: "/admin/orders",
  },
  {
    title: "Store Settings",
    description: "Manage your store preferences.",
    icon: "settings" as const,
    href: "/admin/settings",
  },
];

const statusLabels: Record<string, string> = {
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_for_delivery: "Ready for delivery",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusColors: Record<string, string> = {
  awaiting_confirmation: "bg-amber-400",
  confirmed: "bg-blue-400",
  processing: "bg-violet-400",
  ready_for_delivery: "bg-cyan-500",
  out_for_delivery: "bg-orange-400",
  completed: "bg-emerald-500",
  cancelled: "bg-rose-400",
};

function formatCurrency(value: number | string, currency = "GHS") {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatChartDate(value: string, monthly: boolean) {
  if (!value) return "";

  // Use midday to avoid timezone-related date shifts.
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(
    "en-GH",
    monthly
      ? { month: "short", year: "numeric" }
      : { day: "numeric", month: "short" }
  ).format(date);
}

function formatStatus(value: string) {
  return (
    statusLabels[value] ||
    value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    )
  );
}

function getPaymentStatusStyle(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-700";
    case "partially_paid":
      return "bg-amber-50 text-amber-700";
    case "refunded":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function PremiumLineChart({
  data,
  valueKey,
  color,
  gradientStart,
  gradientEnd,
  label,
  valueFormatter,
}: {
  data: ChartPoint[];
  valueKey: "revenue" | "orders";
  color: string;
  gradientStart: string;
  gradientEnd: string;
  label: string;
  valueFormatter: (value: number) => string;
}) {
  const chartId = valueKey;

  const geometry = useMemo(() => {
    const width = 680;
    const height = 250;
    const left = 48;
    const right = 16;
    const top = 18;
    const bottom = 48;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const values = data.map((point) =>
      Math.max(0, Number(point[valueKey]) || 0)
    );

    const rawMax = Math.max(0, ...values);
    const maxValue =
      valueKey === "orders"
        ? Math.max(4, Math.ceil(rawMax * 1.2))
        : Math.max(100, rawMax * 1.2);

    const points = data.map((point, index) => {
      const value = values[index];
      const x =
        left +
        (data.length <= 1
          ? chartWidth / 2
          : (index / (data.length - 1)) * chartWidth);

      const y =
        top + chartHeight - (value / maxValue) * chartHeight;

      return { ...point, value, x, y };
    });

    const line = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
      )
      .join(" ");

    const area =
      points.length > 0
        ? `${line} L ${points[points.length - 1].x} ${
            top + chartHeight
          } L ${points[0].x} ${top + chartHeight} Z`
        : "";

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      chartHeight,
      maxValue,
      points,
      line,
      area,
    };
  }, [data, valueKey]);

  if (!data.length) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-[#a19891]">
        No {label.toLowerCase()} data available for this period.
      </div>
    );
  }

  const labelInterval =
    data.length > 60 ? 14 :
    data.length > 30 ? 7 :
    data.length > 12 ? 3 :
    data.length > 7 ? 2 : 1;

  return (
    <div className="w-full">
      <div className="overflow-hidden">
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`${label} line chart`}
        >
          <defs>
            <linearGradient
              id={`gradient-${chartId}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={gradientStart} stopOpacity="0.24" />
              <stop offset="100%" stopColor={gradientEnd} stopOpacity="0.015" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3].map((line) => {
            const y =
              geometry.top +
              (geometry.chartHeight / 3) * line;

            const value =
              geometry.maxValue * (1 - line / 3);

            return (
              <g key={line}>
                <line
                  x1={geometry.left}
                  x2={geometry.width - geometry.right}
                  y1={y}
                  y2={y}
                  stroke="#f0e9e4"
                  strokeDasharray="3 5"
                />
                <text
                  x={geometry.left - 9}
                  y={y + 4}
                  textAnchor="end"
                  fill="#a19891"
                  fontSize="10"
                  fontFamily="var(--font-poppins), sans-serif"
                >
                  {valueKey === "orders"
                    ? Math.round(value).toLocaleString()
                    : value >= 1000
                      ? `${(value / 1000).toFixed(1)}k`
                      : Math.round(value).toString()}
                </text>
              </g>
            );
          })}

          <path
            d={geometry.area}
            fill={`url(#gradient-${chartId})`}
          />

          <path
            d={geometry.line}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {geometry.points.map((point, index) => (
            <g key={`${point.date}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={data.length > 30 ? 2.5 : 4}
                fill="#ffffff"
                stroke={color}
                strokeWidth="2"
              >
                <title>
                  {point.label}: {valueFormatter(point.value)}
                </title>
              </circle>

              {(index % labelInterval === 0 ||
                index === data.length - 1) && (
                <text
                  x={point.x}
                  y={geometry.height - 12}
                  textAnchor="middle"
                  fill="#756963"
                  fontFamily="var(--font-poppins), sans-serif"
                  fontSize="10"
                  fontWeight="500"
                >
                  {formatChartDate(point.date, data.length <= 12)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function PaymentLineChart({
  data,
  currency,
}: {
  data: ChartPoint[];
  currency: string;
}) {
  return (
    <PremiumLineChart
      data={data}
      valueKey="revenue"
      color="#a66c72"
      gradientStart="#c88e91"
      gradientEnd="#a66c72"
      label="Net payments"
      valueFormatter={(value) => formatCurrency(value, currency)}
    />
  );
}

function OrdersLineChart({
  data,
}: {
  data: ChartPoint[];
}) {
  return (
    <PremiumLineChart
      data={data}
      valueKey="orders"
      color="#78927d"
      gradientStart="#a7bba9"
      gradientEnd="#78927d"
      label="Orders"
      valueFormatter={(value) =>
        `${value.toLocaleString()} orders`
      }
    />
  );
}


function LoadingCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-[#eee5df] bg-white p-6">
      <div className="h-4 w-28 rounded bg-[#f0e9e4]" />
      <div className="mt-7 h-8 w-36 rounded bg-[#f0e9e4]" />
      <div className="mt-3 h-3 w-24 rounded bg-[#f6f1ed]" />
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { admin: user } = useAdmin();

  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const adminName = user?.name || "Administrator";

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get<DashboardData>(
        "/admin/dashboard",
        {
          params: { period },
        }
      );

      setData(response.data);
    } catch (err: unknown) {
      console.error("Dashboard analytics request failed:", err);

      setError(
        "We couldn't load your dashboard data. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    // This effect starts the asynchronous dashboard request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboard();
  }, [fetchDashboard]);

  const summary = data?.summary;

  const statCards = [
    {
      title: "Net Payments (Selected Period)",
      value: summary
        ? formatCurrency(summary.total_revenue, data?.currency)
        : "—",
      note: "Payments recorded in this period, less refunds",
      icon: "revenue" as const,
      accent: "bg-[#f7e9e7] text-[#a66c72]",
    },
    {
      title: "Orders in Selected Period",
      value: summary
        ? summary.total_orders.toLocaleString()
        : "—",
      note: `${summary?.pending_orders ?? 0} awaiting confirmation (all time)`,
      icon: "orders" as const,
      accent: "bg-[#f5eee5] text-[#a17b53]",
    },
    {
      title: "Total Products",
      value: summary
        ? summary.total_products.toLocaleString()
        : "—",
      note: `${summary?.low_stock_products ?? 0} low stock · ${summary?.out_of_stock_products ?? 0} out of stock`,
      icon: "products" as const,
      accent: "bg-[#edf0e9] text-[#78856c]",
    },
    {
      title: "Total Customers",
      value: summary
        ? summary.total_customers.toLocaleString()
        : "—",
      note: `${summary?.new_customers ?? 0} new in selected period`,
      icon: "customers" as const,
      accent: "bg-[#eeeaf2] text-[#8c789d]",
    },
  ];

  const statusEntries = Object.entries(data?.orders.statuses ?? {})
    .filter(([status]) => status in statusLabels)
    .sort((a, b) => b[1] - a[1]);

  const totalStatusOrders = statusEntries.reduce(
    (total, [, count]) => total + count,
    0
  );

  const completedOrders =
    data?.orders.statuses.completed ?? 0;

  const outstandingOrders =
    (data?.orders.statuses.awaiting_confirmation ?? 0) +
    (data?.orders.statuses.confirmed ?? 0) +
    (data?.orders.statuses.processing ?? 0) +
    (data?.orders.statuses.ready_for_delivery ?? 0) +
    (data?.orders.statuses.out_for_delivery ?? 0);

  return (
    <main className="min-h-screen bg-[#f8f5f1] text-[#49352f]">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">
        {/* Welcome section */}
        <section className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[#a66c72]">
              Welcome back,
            </p>

            <h2 className="mt-2 font-serif text-3xl font-normal md:text-4xl">
              Hello, {adminName}
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b817b]">
              Here&apos;s an overview of your BigFred store. Keep track of
              payments, orders, inventory and customer activity from one
              place.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full border border-[#eadfd8] bg-white px-4 py-2.5 sm:self-auto">
            <span className="h-2 w-2 rounded-full bg-[#819477]" />
            <span className="text-xs font-medium text-[#76665e]">
              Store administration
            </span>
          </div>
        </section>

        {/* API error */}
        {error && (
          <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={fetchDashboard}
              className="shrink-0 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}

        {/* Statistics */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl font-normal">
                Store Overview
              </h3>
              <p className="mt-1 text-xs text-[#a19891]">
                Your key business metrics
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            {loading && !data
              ? Array.from({ length: 4 }).map((_, index) => (
                  <LoadingCard key={index} />
                ))
              : statCards.map((stat) => (
                  <article
  key={stat.title}
  className="group relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl border border-[#eee5df] bg-white p-5 shadow-[0_2px_12px_rgba(73,53,47,0.035)] transition-all duration-300 hover:-translate-y-1 hover:border-[#dfc9c1] hover:shadow-[0_12px_30px_rgba(73,53,47,0.07)] sm:p-6"
>
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-[13px] font-medium tracking-wide text-[#837873]">
        {stat.title}
      </p>
    </div>

    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${stat.accent}`}
    >
      <Icon name={stat.icon} className="h-5 w-5" />
    </div>
  </div>

  <div className="mt-7">
    <p className="font-sans text-[28px] font-semibold tracking-[-0.04em] text-[#49352f] sm:text-[32px]">
      {stat.value}
    </p>
  </div>

  <div className="mt-auto pt-5">
    <div className="border-t border-[#f1ebe6] pt-3">
      <p className="text-xs leading-5 text-[#968b84]">
        {stat.note}
      </p>
    </div>
  </div>
</article>

                ))}
          </div>
        </section>

        {/* Separate Payments and Orders charts */}
<section className="mt-9">
  <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h3 className="font-serif text-xl font-normal text-[#352b29]">
        Business Performance
      </h3>
      <p className="mt-1 text-xs text-[#a19891]">
        Payment collections and order activity for the selected period
      </p>
    </div>

    <div className="flex w-fit rounded-xl border border-[#eee5df] bg-[#faf7f4] p-1">
      {(
        [
          ["7d", "7 days"],
          ["30d", "30 days"],
          ["12m", "12 months"],
        ] as [Period, string][]
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setPeriod(value)}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
            period === value
              ? "bg-white text-[#5D3954] shadow-sm"
              : "text-[#928780] hover:text-[#5D3954]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  </div>

  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
    {/* Payments card */}
    <article className="min-w-0 overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-sm">
      <div className="border-b border-[#f1ebe6] px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-serif text-lg font-normal text-[#352b29]">
              Payments
            </h4>
            <p className="mt-1 text-xs text-[#a19891]">
              Net collections after refunds
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8eeee] text-[#a66c72]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M3 7.5h18v11H3z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 10h18M7 15h3" strokeLinecap="round" />
            </svg>
          </span>
        </div>

        <div className="mt-5">
          <p className="text-xs text-[#a19891]">
            Net payments collected
          </p>
          <p className="mt-1 font-serif text-2xl font-medium text-[#5D3954]">
            {formatCurrency(data?.revenue.net_revenue ?? 0, data?.currency ?? "GHS")}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#f3eeea] pt-4">
          <div>
            <p className="text-[11px] text-[#a19891]">Gross payments</p>
            <p className="mt-1 text-sm font-semibold text-[#514541]">
              {formatCurrency(data?.revenue.gross_payments ?? 0, data?.currency ?? "GHS")}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[#a19891]">Refunds</p>
            <p className="mt-1 text-sm font-semibold text-[#514541]">
              {formatCurrency(data?.revenue.refunds ?? 0, data?.currency ?? "GHS")}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#a66c72]" />
          <span className="text-xs text-[#837873]">Net payments</span>
        </div>

        {loading && !data ? (
          <div className="h-[250px] animate-pulse rounded-xl bg-[#faf7f4]" />
        ) : (
          <PaymentLineChart
            data={data?.revenue.chart ?? []}
            currency={data?.currency ?? "GHS"}
          />
        )}
      </div>
    </article>

    {/* Orders card */}
    <article className="min-w-0 overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-sm">
      <div className="border-b border-[#f1ebe6] px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-serif text-lg font-normal text-[#352b29]">
              Orders
            </h4>
            <p className="mt-1 text-xs text-[#a19891]">
              Orders created during the selected period
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf3ee] text-[#78927d]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 7h16l-1.5 13h-13L4 7Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 9V6a3 3 0 0 1 6 0v3" strokeLinecap="round" />
            </svg>
          </span>
        </div>

        <div className="mt-5">
          <p className="text-xs text-[#a19891]">
            Total orders in selected period
          </p>
          <p className="mt-1 font-serif text-2xl font-medium text-[#5D3954]">
            {(data?.summary.total_orders ?? 0).toLocaleString()}
          </p>
        </div>

        <div className="mt-5 border-t border-[#f3eeea] pt-4">
          <p className="text-[11px] text-[#a19891]">
            Order volume over time
          </p>
          <p className="mt-1 text-sm font-medium text-[#514541]">
            {(data?.revenue.chart ?? []).reduce((total, point) => total + point.orders, 0).toLocaleString()} orders recorded
          </p>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#78927d]" />
          <span className="text-xs text-[#837873]">Orders created</span>
        </div>

        {loading && !data ? (
          <div className="h-[250px] animate-pulse rounded-xl bg-[#faf7f4]" />
        ) : (
          <OrdersLineChart data={data?.revenue.chart ?? []} />
        )}
      </div>
    </article>
  </div>
</section>
{/* Orders and reviews */}
        <section className="mt-9 grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
          {/* Recent orders */}
          <article className="overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-sm xl:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-[#f1ebe6] px-5 py-5 sm:px-6">
              <div>
                <h3 className="font-serif text-xl font-normal">
                  Recent Orders
                </h3>
                <p className="mt-1 text-xs text-[#a19891]">
                  Your latest customer purchases
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/admin/orders")}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#a66c72] transition hover:bg-[#fbf3f1]"
              >
                View all
                <Icon name="arrow" className="h-4 w-4" />
              </button>
            </div>

            {!data?.orders.recent?.length ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f8f0ed] text-[#a66c72]">
                  <Icon name="orders" className="h-7 w-7" />
                </div>
                <h4 className="mt-5 font-sans text-lg font-semibold">
                  No orders yet
                </h4>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#a19891]">
                  New customer purchases will appear here as soon as orders
                  are placed.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#f3ede8]">
                {data.orders.recent.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() =>
                      router.push(`/admin/orders/${order.id}`)
                    }
                    className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-[#fdfaf8] sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#49352f]">
                        {order.customer_name || "Customer"}
                      </p>
                      <p className="mt-1 text-xs text-[#a19891]">
                        {order.order_number} ·{" "}
                        {formatDate(order.created_at)}
                      </p>
                      <p className="mt-1 text-[11px] text-[#a19891]">
                        {order.items?.length ?? 0} product line(s)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="rounded-full bg-[#f8f0ed] px-3 py-1.5 text-[10px] font-semibold text-[#8e6265]">
                        {formatStatus(order.status)}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${getPaymentStatusStyle(
                          order.payment_status
                        )}`}
                      >
                        {formatStatus(order.payment_status)}
                      </span>
                      <span className="w-full text-sm font-semibold sm:w-auto sm:text-right">
                        {formatCurrency(order.total, data.currency)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </article>

          {/* Review panel */}
          <article className="flex flex-col overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-sm">
            <div className="border-b border-[#f1ebe6] px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-normal">
                  Customer Reviews
                </h3>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8f0ed] text-[#a66c72]">
                  <Icon name="review" className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-1 text-xs text-[#a19891]">
                Customer feedback and moderation
              </p>
            </div>

            <div className="flex flex-1 flex-col justify-center px-6 py-7">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#faf7f4] p-4">
                  <p className="text-xs text-[#a19891]">Pending</p>
                  <p className="mt-2 font-sans text-2xl font-semibold text-[#a66c72]">
                    {data?.reviews.pending ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f3f5ef] p-4">
                  <p className="text-xs text-[#a19891]">Approved</p>
                  <p className="mt-2 font-sans text-2xl font-semibold text-[#78856c]">
                    {data?.reviews.approved ?? "—"}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex justify-between text-xs text-[#837873]">
                  <span>Total reviews</span>
                  <span className="font-semibold">
                    {summary?.total_reviews ?? "—"}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f1ebe6]">
                  <div
                    className="h-full rounded-full bg-[#a66c72] transition-all"
                    style={{
                      width: `${
                        summary?.total_reviews
                          ? (data!.reviews.approved /
                              summary.total_reviews) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-[#aaa09a]">
                  Approved reviews as a share of all submissions
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/admin/reviews")}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#49352f] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#35251f]"
              >
                Manage Reviews
                <Icon name="arrow" className="h-4 w-4" />
              </button>
            </div>
          </article>
          {/* Customer insights */}
          <article className="rounded-2xl border border-[#eee5df] bg-white p-5 shadow-[0_2px_12px_rgba(73,53,47,0.035)] transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(73,53,47,0.06)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-xl font-normal text-[#49352f]">
                  Customer Insights
                </h3>
                <p className="mt-1 text-xs text-[#a19891]">
                  Overview of your customer base
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eeeaf2] text-[#8c789d]">
                <Icon name="customers" className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#eee8e2] bg-[#faf7f4] p-4">
                <p className="text-xs font-medium text-[#968b84]">
                  Total customers
                </p>
                <p className="mt-3 font-sans text-3xl font-semibold tracking-tight text-[#49352f]">
                  {(data?.customers.total ?? 0).toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-[#a19891]">
                  All-time registered
                </p>
              </div>

              <div className="rounded-xl border border-[#e9e3ed] bg-[#f7f4f9] p-4">
                <p className="text-xs font-medium text-[#8c789d]">
                  New customers
                </p>
                <p className="mt-3 font-sans text-3xl font-semibold tracking-tight text-[#806b91]">
                  {(data?.customers.new_in_period ?? 0).toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-[#9889a3]">
                  In selected period
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#f1ebe6] pt-5">
              <div>
                <p className="text-sm font-semibold text-[#49352f]">
                  Customer acquisition
                </p>
                <p className="mt-1 text-xs leading-5 text-[#a19891]">
                  New registrations during the selected reporting period
                </p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eeeaf2] text-[#8c789d]">
                <Icon name="customers" className="h-4 w-4" />
              </span>
            </div>
          </article>
        </section>

        {/* Order status and inventory */}
        <section className="mt-9 grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
          {/* Order status */}
          <article className="rounded-2xl border border-[#eee5df] bg-white p-5 shadow-[0_2px_12px_rgba(73,53,47,0.035)] transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(73,53,47,0.06)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl font-normal text-[#49352f]">
                  Order Status
                </h3>
                <p className="mt-1 text-xs text-[#a19891]">
                  All-time overview of order stages
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f8f0ed] text-[#a66c72]">
                <Icon name="chart" />
              </div>
            </div>

            <div className="mt-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#a19891]">
                    Total orders
                  </p>
                  <p className="mt-2 font-sans text-4xl font-semibold tracking-tight text-[#49352f]">
                    {totalStatusOrders.toLocaleString()}
                  </p>
                </div>

                <p className="pb-1 text-xs text-[#a19891]">
                  Across all order stages
                </p>
              </div>

              <div className="mt-6 flex h-3.5 gap-1 overflow-hidden rounded-full bg-[#f3ede8]">
                {statusEntries.map(([status, count]) => (
                  <div
                    key={status}
                    className={`h-full min-w-0 rounded-full transition-all duration-500 ${
                      statusColors[status] || "bg-gray-300"
                    }`}
                    style={{
                      width: `${
                        totalStatusOrders
                          ? (count / totalStatusOrders) * 100
                          : 0
                      }%`,
                    }}
                    title={`${formatStatus(status)}: ${count}`}
                  />
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {statusEntries.map(([status, count]) => (
                  <div
                    key={status}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#f1ebe6] bg-[#fdfbf9] px-3.5 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          statusColors[status] || "bg-gray-300"
                        }`}
                      />
                      <span className="truncate text-xs font-medium text-[#837873]">
                        {formatStatus(status)}
                      </span>
                    </div>

                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[#49352f]">
                      {count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#f1ebe6] pt-5">
                <div className="rounded-xl bg-[#f8f5f1] p-4">
                  <p className="text-xs font-medium text-[#968b84]">
                    In Progress
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-[#a17b53]">
                    {outstandingOrders.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] text-[#a19891]">
                    Active orders
                  </p>
                </div>

                <div className="rounded-xl bg-[#edf0e9] p-4">
                  <p className="text-xs font-medium text-[#78856c]">
                    Completed
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-[#78856c]">
                    {completedOrders.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8b9781]">
                    Successfully completed
                  </p>
                </div>
              </div>
            </div>
          </article>
          {/* Inventory */}
          <article className="rounded-2xl border border-[#eee5df] bg-white p-5 shadow-[0_2px_12px_rgba(73,53,47,0.035)] transition-shadow duration-300 hover:shadow-[0_12px_30px_rgba(73,53,47,0.06)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-serif text-xl font-normal text-[#49352f]">
                  Inventory Overview
                </h3>
                <p className="mt-1 text-xs text-[#a19891]">
                  Monitor product availability and stock levels
                </p>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf0e9] text-[#78856c]">
                <Icon name="package" />
              </div>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2.5 sm:gap-3">
              <div className="rounded-xl border border-[#eee8e2] bg-[#faf7f4] p-3 sm:p-4">
                <p className="text-[10px] font-medium text-[#968b84] sm:text-xs">
                  Products
                </p>
                <p className="mt-3 font-sans text-2xl font-semibold tracking-tight text-[#49352f] sm:text-3xl">
                  {data?.inventory.total_products ?? "—"}
                </p>
                <p className="mt-1 text-[10px] text-[#a19891]">
                  Active
                </p>
              </div>

              <div className="rounded-xl border border-amber-100 bg-[#fff9f0] p-3 sm:p-4">
                <p className="text-[10px] font-medium text-amber-700 sm:text-xs">
                  Low Stock
                </p>
                <p className="mt-3 font-sans text-2xl font-semibold tracking-tight text-amber-800 sm:text-3xl">
                  {data?.inventory.low_stock ?? "—"}
                </p>
                <p className="mt-1 text-[10px] text-amber-700">
                  Restock soon
                </p>
              </div>

              <div className="rounded-xl border border-rose-100 bg-[#fff5f4] p-3 sm:p-4">
                <p className="text-[10px] font-medium text-rose-700 sm:text-xs">
                  Out of Stock
                </p>
                <p className="mt-3 font-sans text-2xl font-semibold tracking-tight text-rose-800 sm:text-3xl">
                  {data?.inventory.out_of_stock ?? "—"}
                </p>
                <p className="mt-1 text-[10px] text-rose-700">
                  Unavailable
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#f1ebe6] pt-5">
              <div>
                <p className="text-sm font-semibold text-[#49352f]">
                  Inventory attention
                </p>
                <p className="mt-1 text-xs text-[#a19891]">
                  Review products that need restocking
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/admin/products")}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#a66c72] transition hover:bg-[#fbf3f1]"
              >
                Manage products
                <Icon name="arrow" className="h-4 w-4" />
              </button>
            </div>

            {(data?.inventory.low_stock ?? 0) +
              (data?.inventory.out_of_stock ?? 0) >
            0 ? (
              <div className="mt-4 space-y-2 rounded-xl border border-amber-100 bg-[#fffaf2] px-4 py-3">
                {(data?.inventory.low_stock ?? 0) > 0 && (
                  <p className="text-xs leading-5 text-amber-800">
                    <strong>{data?.inventory.low_stock}</strong>{" "}
                    products are running low and may need restocking soon.
                  </p>
                )}

                {(data?.inventory.out_of_stock ?? 0) > 0 && (
                  <p className="text-xs leading-5 text-rose-800">
                    <strong>{data?.inventory.out_of_stock}</strong>{" "}
                    products are currently out of stock.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-[#e5ebdf] bg-[#f5f7f2] px-4 py-3">
                <p className="text-xs leading-5 text-[#718064]">
                  Your active inventory currently has no low-stock or out-of-stock alerts.
                </p>
              </div>
            )}
          </article>
        </section>

        {/* Top-selling products */}
        <section className="mt-9 overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-[0_2px_12px_rgba(73,53,47,0.035)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f1ebe6] px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <h3 className="font-serif text-xl font-normal text-[#49352f]">
                Top-Selling Products
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#a19891]">
                Best performers in the selected period, based on confirmed and later-stage orders. Awaiting-confirmation and cancelled orders are excluded.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/admin/products")}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#a66c72] transition hover:bg-[#fbf3f1]"
            >
              Manage products
              <Icon name="arrow" className="h-4 w-4" />
            </button>
          </div>

          {!data?.inventory.top_selling?.length ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8f0ed] text-[#a66c72]">
                <Icon name="chart" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#49352f]">
                No product sales to display yet
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-[#a19891]">
                Eligible product sales for this period will appear here once orders are confirmed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f3ede8]">
              {data.inventory.top_selling.map((product, index) => {
                const maximumUnits = Math.max(
                  ...data.inventory.top_selling.map((item) => item.units_sold),
                  1
                );

                const performanceWidth = Math.max(
                  (product.units_sold / maximumUnits) * 100,
                  3
                );

                const rankStyle =
                  index === 0
                    ? "bg-[#f5eee5] text-[#a17b53]"
                    : index === 1
                      ? "bg-[#f3f1ee] text-[#81766c]"
                      : index === 2
                        ? "bg-[#f8f0ed] text-[#a66c72]"
                        : "bg-[#faf7f4] text-[#968b84]";

                return (
                  <div
                    key={`${product.product_id ?? "deleted"}-${product.product_name}`}
                    className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[#fdfbf9] sm:gap-5 sm:px-6"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-sans text-sm font-semibold ${rankStyle}`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#49352f]">
                        {product.product_name}
                      </p>

                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f1ebe6]">
                          <div
                            className={`h-full rounded-full ${
                              index === 0
                                ? "bg-[#a17b53]"
                                : index === 1
                                  ? "bg-[#a99d90]"
                                  : index === 2
                                    ? "bg-[#a66c72]"
                                    : "bg-[#c9b9ad]"
                            }`}
                            style={{ width: `${performanceWidth}%` }}
                          />
                        </div>

                        <span className="shrink-0 text-[11px] tabular-nums text-[#a19891]">
                          {product.units_sold.toLocaleString()} units
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-[#49352f]">
                        {formatCurrency(product.sales_value, data.currency)}
                      </p>
                      <p className="mt-1 text-[10px] text-[#a19891]">
                        Sales value
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        {/* Quick actions */}
        <section className="mt-9">
          <div className="mb-5">
            <h3 className="font-serif text-xl font-normal">
              Quick Actions
            </h3>
            <p className="mt-1 text-xs text-[#a19891]">
              Get things done quickly from your dashboard
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <button
                key={action.title}
                type="button"
                onClick={() => router.push(action.href)}
                className="group flex items-center gap-4 rounded-2xl border border-[#eee5df] bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#e3c8c2] hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f8f0ed] text-[#a66c72] transition group-hover:bg-[#f1dfdc]">
                  <Icon name={action.icon} className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#49352f]">
                    {action.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#a19891]">
                    {action.description}
                  </span>
                </span>

                <Icon
                  name="arrow"
                  className="h-4 w-4 shrink-0 text-[#b7a7a0] transition group-hover:translate-x-1 group-hover:text-[#a66c72]"
                />
              </button>
            ))}
          </div>
        </section>

        {/* Store management banner */}
        <section className="relative mt-9 overflow-hidden rounded-2xl bg-[#ead5d0] px-6 py-8 sm:px-9 sm:py-10">
          <div className="relative z-10 max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#95676a]">
              The BigFred workspace
            </p>

            <h3 className="mt-3 font-sans text-2xl font-semibold leading-tight text-[#49352f] sm:text-3xl">
              Your business, beautifully managed.
            </h3>

            <p className="mt-3 max-w-xl text-sm leading-6 text-[#765c56]">
              Manage your products, organise your collections and stay
              connected with your customers, all from one place.
            </p>
          </div>

          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/20" />
          <div className="pointer-events-none absolute -bottom-28 right-28 h-64 w-64 rounded-full border-[25px] border-white/15" />
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-[#eae1db] py-6 text-center">
          <p className="text-[11px] tracking-wide text-[#aaa09a]">
            © {new Date().getFullYear()} BigFred. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
