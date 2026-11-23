
"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import api from "@/lib/api";

type PromotionStatus = "active" | "scheduled" | "expired" | "disabled";

type Product = {
  id: number;
  name: string;
  sku?: string;
  price: string | number;
  is_active: boolean;
};

type DeliveryZone = {
  id: number;
  name: string;
  delivery_fee: string | number;
  is_active: boolean;
};

type ProductRule = {
  product_id: string;
  discount_type: "" | "percentage" | "fixed";
  discount_application: "per_unit" | "per_order";
  discount_value: string;
};

type PromotionProduct = Product & {
  pivot?: {
    discount_type?: "percentage" | "fixed" | null;
    discount_application?: "per_unit" | "per_order";
    discount_value?: string | number | null;
  };
};

type Promotion = {
  id: number;
  name: string;
  description?: string | null;
  discount_type?: "percentage" | "fixed" | null;
  discount_application?: "per_unit" | "per_order";
  discount_value?: string | number | null;
  applies_to_all_products: boolean;
  free_delivery: boolean;
  can_combine: boolean;
  minimum_order_value?: string | number | null;
  starts_at: string;
  ends_at: string;
  is_enabled: boolean;
  products?: PromotionProduct[];
  delivery_zones?: DeliveryZone[];
  delivery_zone_ids?: number[];
  products_count?: number;
  delivery_zones_count?: number;
  orders_count?: number;
};

type PromotionForm = {
  name: string;
  description: string;
  discount_type: "" | "percentage" | "fixed";
  discount_application: "per_unit" | "per_order";
  discount_value: string;
  applies_to_all_products: boolean;
  free_delivery: boolean;
  can_combine: boolean;
  minimum_order_value: string;
  starts_at: string;
  ends_at: string;
  is_enabled: boolean;
  products: ProductRule[];
  delivery_zone_ids: string[];
};

type PreviewResult = {
  subtotal: number;
  product_discount_amount: number;
  original_delivery_fee: number;
  delivery_discount_amount: number;
  delivery_fee: number;
  total: number;
  promotion_name?: string | null;
  applied_promotions?: Array<{
    id?: number;
    name?: string;
    discount_amount?: number;
  }>;
  delivery_zone_name?: string | null;
  delivery_quote_pending?: boolean;
};

const emptyForm: PromotionForm = {
  name: "",
  description: "",
  discount_type: "percentage",
  discount_application: "per_unit",
  discount_value: "",
  applies_to_all_products: true,
  free_delivery: false,
  can_combine: false,
  minimum_order_value: "",
  starts_at: "",
  ends_at: "",
  is_enabled: true,
  products: [],
  delivery_zone_ids: [],
};

const inputClass =
  "w-full rounded-xl border border-[#e9dfd8] bg-white px-4 py-3 text-sm text-[#49352f] outline-none transition placeholder:text-gray-400 focus:border-[#a66c72] focus:ring-2 focus:ring-[#a66c72]/10";

const primaryButton =
  "rounded-xl bg-[#49352f] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#35251f] disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButton =
  "rounded-xl border border-[#e9dfd8] bg-white px-5 py-3 text-sm font-medium text-[#49352f] transition hover:bg-[#f8f5f1] disabled:opacity-50";

function getRows<T>(response: unknown): T[] {
  if (!response || typeof response !== "object" || !("data" in response)) {
    return [];
  }

  const responseData = response.data;

  if (
    !responseData ||
    typeof responseData !== "object" ||
    !("data" in responseData)
  ) {
    return [];
  }

  const data = responseData.data;

  if (Array.isArray(data)) return data as T[];

  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    Array.isArray(data.data)
  ) {
    return data.data as T[];
  }

  return [];
}

type ApiErrorResponse = {
  errors?: Record<string, string[]>;
  message?: string;
};

function isAuthError(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 403)
  );
}

function getErrorMessage(error: unknown): string {
  if (!isAxiosError<ApiErrorResponse>(error)) {
    return error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
  }

  if (isAuthError(error)) {
    return "Your session has expired or you do not have permission. Please sign in again.";
  }

  const validationErrors = error.response?.data?.errors;

  if (validationErrors && typeof validationErrors === "object") {
    const first = Object.values(validationErrors).flat()[0];
    if (typeof first === "string") return first;
  }

  return (
    error.response?.data?.message ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

function getPromotionStatus(promotion: Promotion): PromotionStatus {
  if (!promotion.is_enabled) return "disabled";

  const now = new Date();
  const start = new Date(promotion.starts_at);
  const end = new Date(promotion.ends_at);

  if (start > now) return "scheduled";
  if (end < now) return "expired";

  return "active";
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value?: string | null) {
  if (!value) return "â€”";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return local.toISOString().slice(0, 16);
}

function statusClasses(status: PromotionStatus) {
  const styles: Record<PromotionStatus, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    expired: "bg-gray-100 text-gray-600 border-gray-200",
    disabled: "bg-red-50 text-red-700 border-red-200",
  };

  return styles[status];
}

function statusLabel(status: PromotionStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h3 className="font-serif text-xl text-[#49352f]">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  );
}

export default function PromotionsPage() {
  const router = useRouter();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [filter, setFilter] = useState<"all" | PromotionStatus>("all");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState<PromotionForm>(emptyForm);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewProductId, setPreviewProductId] = useState("");
  const [previewQuantity, setPreviewQuantity] = useState("1");
  const [previewZoneId, setPreviewZoneId] = useState("");

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchPromotions = useCallback(async () => {
    const response = await api.get("/admin/promotions");
    setPromotions(getRows<Promotion>(response));
  }, []);

  const fetchSupportingData = useCallback(async () => {
    const [productResponse, zoneResponse] = await Promise.all([
      api.get("/admin/products", {
        params: { status: "active" },
      }),
      api.get("/admin/delivery-zones"),
    ]);

    const productRows = getRows<Product>(productResponse);
    const zoneRows = getRows<DeliveryZone>(zoneResponse);

    setProducts(productRows.filter((product) => product.is_active));
    setZones(zoneRows.filter((zone) => zone.is_active));
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([fetchPromotions(), fetchSupportingData()]);
    } catch (err: unknown) {
      setError(getErrorMessage(err));

      if (isAuthError(err)) {
        router.replace("/admin/login");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchPromotions, fetchSupportingData, router]);

  useEffect(() => {
    // Starts the asynchronous promotions and supporting-data requests.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage();
  }, [loadPage]);

  const filteredPromotions = useMemo(() => {
    return promotions.filter((promotion) => {
      const status = getPromotionStatus(promotion);

      const matchesStatus = filter === "all" || status === filter;
      const matchesSearch = promotion.name
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [promotions, filter, search]);

  const counts = useMemo(() => {
    return {
      total: promotions.length,
      active: promotions.filter((item) => getPromotionStatus(item) === "active").length,
      scheduled: promotions.filter((item) => getPromotionStatus(item) === "scheduled").length,
      expired: promotions.filter((item) => getPromotionStatus(item) === "expired").length,
      disabled: promotions.filter((item) => getPromotionStatus(item) === "disabled").length,
    };
  }, [promotions]);

  const updateForm = <K extends keyof PromotionForm>(
    key: K,
    value: PromotionForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      starts_at: toDateTimeLocal(new Date().toISOString()),
    });
    setPreview(null);
    setError("");
    setNotice("");
    setShowModal(true);
  };

  const openEdit = async (promotion: Promotion) => {
    setError("");
    setNotice("");
    setPreview(null);
    setShowModal(true);
    setEditingId(promotion.id);
    setForm(emptyForm);

    try {
      const response = await api.get(`/admin/promotions/${promotion.id}`);
      const item: Promotion = response.data.data;

      const productRules: ProductRule[] = (item.products || []).map((product) => ({
        product_id: String(product.id),
        discount_type: product.pivot?.discount_type || "",
        discount_application:
          product.pivot?.discount_application || "per_unit",
        discount_value:
          product.pivot?.discount_value == null
            ? ""
            : String(product.pivot.discount_value),
      }));

      const deliveryZoneIds =
        item.delivery_zone_ids ||
        (item.delivery_zones || []).map((zone) => zone.id);

      setForm({
        name: item.name || "",
        description: item.description || "",
        discount_type: item.discount_type || "",
        discount_application: item.discount_application || "per_unit",
        discount_value:
          item.discount_value == null ? "" : String(item.discount_value),
        applies_to_all_products: Boolean(item.applies_to_all_products),
        free_delivery: Boolean(item.free_delivery),
        can_combine: Boolean(item.can_combine),
        minimum_order_value:
          item.minimum_order_value == null
            ? ""
            : String(item.minimum_order_value),
        starts_at: toDateTimeLocal(item.starts_at),
        ends_at: toDateTimeLocal(item.ends_at),
        is_enabled: Boolean(item.is_enabled),
        products: productRules,
        delivery_zone_ids: deliveryZoneIds.map(String),
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err));

      if (isAuthError(err)) {
        router.replace("/admin/login");
      }
    }
  };

  const addProductRule = () => {
    updateForm("products", [
      ...form.products,
      {
        product_id: "",
        discount_type: "",
        discount_application: "per_unit",
        discount_value: "",
      },
    ]);
  };

  const updateProductRule = (
    index: number,
    key: keyof ProductRule,
    value: string
  ) => {
    updateForm(
      "products",
      form.products.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [key]: value } : rule
      )
    );
  };

  const removeProductRule = (index: number) => {
    updateForm(
      "products",
      form.products.filter((_, ruleIndex) => ruleIndex !== index)
    );
  };

  const toggleZone = (zoneId: string) => {
    const selected = form.delivery_zone_ids.includes(zoneId);

    updateForm(
      "delivery_zone_ids",
      selected
        ? form.delivery_zone_ids.filter((id) => id !== zoneId)
        : [...form.delivery_zone_ids, zoneId]
    );
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || null,
    discount_type: form.discount_type || null,
    discount_application: form.discount_application,
    discount_value: form.discount_value === "" ? null : Number(form.discount_value),
    applies_to_all_products: form.applies_to_all_products,
    free_delivery: form.free_delivery,
    can_combine: form.can_combine,
    minimum_order_value:
      form.minimum_order_value === "" ? null : Number(form.minimum_order_value),
    starts_at: form.starts_at,
    ends_at: form.ends_at,
    is_enabled: form.is_enabled,
    products: form.products
      .filter((rule) => rule.product_id !== "")
      .map((rule) => ({
        product_id: Number(rule.product_id),
        discount_type: rule.discount_type || null,
        discount_application: rule.discount_application,
        discount_value:
          rule.discount_value === "" ? null : Number(rule.discount_value),
      })),
    delivery_zone_ids: form.delivery_zone_ids.map(Number),
  });

  const validateForm = () => {
    if (!form.name.trim()) return "Enter a promotion name.";
    if (!form.starts_at || !form.ends_at) return "Select both start and end dates.";

    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      return "The end date must be after the start date.";
    }

    if (
      !form.free_delivery &&
      !form.discount_type &&
      form.products.length === 0
    ) {
      return "Add a discount or enable free delivery.";
    }

    if (
      form.discount_type &&
      (!form.discount_value || Number(form.discount_value) <= 0)
    ) {
      return "Enter a valid global discount value.";
    }

    if (
      form.discount_type === "percentage" &&
      Number(form.discount_value) > 100
    ) {
      return "Percentage discounts cannot exceed 100%.";
    }

    if (!form.applies_to_all_products && form.products.length === 0) {
      return "Select at least one product for this promotion.";
    }

    if (form.free_delivery && form.delivery_zone_ids.length === 0) {
      return "Select at least one delivery zone for free delivery.";
    }

    for (const rule of form.products) {
      if (!rule.product_id) return "Select a product for each product rule.";

      if (!form.free_delivery && (!rule.discount_type || !rule.discount_value)) {
        return "Complete the discount details for each selected product.";
      }

      if (
        rule.discount_type === "percentage" &&
        Number(rule.discount_value) > 100
      ) {
        return "Product percentage discounts cannot exceed 100%.";
      }
    }

    return "";
  };

  const savePromotion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const validationMessage = validateForm();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload();

      if (editingId) {
        await api.put(`/admin/promotions/${editingId}`, payload);
        setNotice("Promotion updated successfully.");
      } else {
        await api.post("/admin/promotions", payload);
        setNotice("Promotion created successfully.");
      }

      setShowModal(false);
      setPreview(null);
      await fetchPromotions();
    } catch (err: unknown) {
      setError(getErrorMessage(err));

      if (isAuthError(err)) {
        router.replace("/admin/login");
      }
    } finally {
      setSaving(false);
    }
  };

  const togglePromotionStatus = async (promotion: Promotion) => {
    setTogglingId(promotion.id);
    setError("");
    setNotice("");

    try {
      await api.patch(`/admin/promotions/${promotion.id}/status`, {
        is_enabled: !promotion.is_enabled,
      });

      setNotice(
        promotion.is_enabled
          ? "Promotion disabled."
          : "Promotion enabled."
      );

      await fetchPromotions();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const deletePromotion = async (promotion: Promotion) => {
    const confirmed = window.confirm(
      `Delete "${promotion.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(promotion.id);
    setError("");
    setNotice("");

    try {
      await api.delete(`/admin/promotions/${promotion.id}`);
      setNotice("Promotion deleted successfully.");
      await fetchPromotions();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const runPreview = async () => {
    setError("");
    setPreview(null);

    if (!showModal) return;

    if (!form.name.trim()) {
      setError("Enter a promotion name before previewing.");
      return;
    }

    if (!previewProductId) {
      setError("Select a product for the order preview.");
      return;
    }

    const quantity = Number(previewQuantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      setError("Preview quantity must be between 1 and 1000.");
      return;
    }

    setPreviewLoading(true);

    try {
      const payload = {
        ...buildPayload(),
        items: [
          {
            product_id: Number(previewProductId),
            quantity,
          },
        ],
        delivery_zone_id: previewZoneId
          ? Number(previewZoneId)
          : null,
      };

      const response = await api.post("/admin/promotions/preview", payload);
      setPreview(response.data.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeModal = () => {
    if (saving || previewLoading) return;

    setShowModal(false);
    setEditingId(null);
    setPreview(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#f8f5f1] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[#a66c72]">
              Store management
            </p>

            <h1 className="mt-2 font-serif text-3xl text-[#49352f] md:text-4xl">
              Promotions
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              Create special offers, manage product discounts and reward your
              customers with delivery promotions.
            </p>
          </div>

          <button type="button" onClick={openCreate} className={primaryButton}>
            + Create Promotion
          </button>
        </div>

        {notice && (
          <div
            role="status"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>Ã—</button>
          </div>
        )}

        {error && !showModal && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError("")}>Ã—</button>
          </div>
        )}

        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total promotions", value: counts.total, icon: "âœ¦" },
            { label: "Active", value: counts.active, icon: "âœ“" },
            { label: "Scheduled", value: counts.scheduled, icon: "â—·" },
            { label: "Expired", value: counts.expired, icon: "âŒ›" },
            { label: "Disabled", value: counts.disabled, icon: "âŠ˜" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[#eee5df] bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {stat.label}
                </p>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6e9e7] text-lg text-[#a66c72]">
                  {stat.icon}
                </span>
              </div>

              <p className="mt-4 text-3xl font-semibold text-[#49352f]">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-[#f0eae5] p-6 md:flex-row md:items-center">
            <div>
              <h2 className="font-serif text-xl text-[#49352f]">
                Promotion campaigns
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                View and manage your store offers.
              </p>
            </div>

            <span className="rounded-full bg-[#f8f5f1] px-3 py-1.5 text-xs font-medium text-[#a66c72]">
              {filteredPromotions.length}{" "}
              {filteredPromotions.length === 1 ? "promotion" : "promotions"}
            </span>
          </div>

          <div className="grid gap-3 border-b border-[#f0eae5] p-6 md:grid-cols-[1fr_240px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search promotion name..."
              aria-label="Search promotions"
              className={inputClass}
            />

            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as "all" | PromotionStatus)}
              aria-label="Filter promotions"
              className={inputClass}
            >
              <option value="all">All promotions</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {loading ? (
            <div className="p-16 text-center text-sm text-gray-500">
              Loading promotions...
            </div>
          ) : filteredPromotions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8f5f1] text-2xl text-[#a66c72]">
                âœ¦
              </div>

              <h3 className="mt-4 font-serif text-xl text-[#49352f]">
                No promotions found
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                Create your first promotion to introduce discounts and special
                delivery offers to your customers.
              </p>

              <button
                type="button"
                onClick={openCreate}
                className={`${primaryButton} mt-5`}
              >
                Create your first promotion
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-[#fbf9f7] text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Promotion</th>
                    <th className="px-6 py-4 font-medium">Offer</th>
                    <th className="px-6 py-4 font-medium">Products</th>
                    <th className="px-6 py-4 font-medium">Schedule</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#f0eae5]">
                  {filteredPromotions.map((promotion) => {
                    const status = getPromotionStatus(promotion);

                    const offer = promotion.free_delivery
                      ? promotion.discount_type
                        ? "Discount + free delivery"
                        : "Free delivery"
                      : promotion.discount_type === "percentage"
                        ? `${promotion.discount_value}% off`
                        : promotion.discount_type === "fixed"
                          ? `${formatMoney(promotion.discount_value)} off`
                          : "Product-specific offer";

                    return (
                      <tr key={promotion.id} className="transition hover:bg-[#fdfbf9]">
                        <td className="px-6 py-5">
                          <p className="font-semibold text-[#49352f]">
                            {promotion.name}
                          </p>
                          <p className="mt-1 max-w-xs truncate text-xs text-gray-400">
                            {promotion.description || "No description"}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <span className="font-medium text-[#a66c72]">
                            {offer}
                          </span>
                          {promotion.can_combine && (
                            <p className="mt-1 text-xs text-gray-400">
                              Combinable
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-5 text-gray-600">
                          {promotion.applies_to_all_products
                            ? "All products"
                            : `${promotion.products_count ?? promotion.products?.length ?? 0} selected`}
                        </td>

                        <td className="px-6 py-5 text-xs text-gray-500">
                          <p>{formatDate(promotion.starts_at)}</p>
                          <p className="mt-1">to {formatDate(promotion.ends_at)}</p>
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(status)}`}
                          >
                            {statusLabel(status)}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(promotion)}
                              className="rounded-lg border border-[#e9dfd8] px-3 py-2 text-xs font-medium text-[#49352f] hover:bg-[#f8f5f1]"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => togglePromotionStatus(promotion)}
                              disabled={togglingId === promotion.id}
                              className="rounded-lg border border-[#e9dfd8] px-3 py-2 text-xs font-medium text-[#49352f] hover:bg-[#f8f5f1] disabled:opacity-50"
                            >
                              {togglingId === promotion.id
                                ? "Saving..."
                                : promotion.is_enabled
                                  ? "Disable"
                                  : "Enable"}
                            </button>

                            <button
                              type="button"
                              onClick={() => deletePromotion(promotion)}
                              disabled={deletingId === promotion.id}
                              className="rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === promotion.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#241914]/55 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="my-4 w-full max-w-5xl overflow-hidden rounded-2xl bg-[#fdfbf9] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eee5df] bg-white px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#a66c72]">
                  Campaign configuration
                </p>
                <h2 className="mt-1 font-serif text-2xl text-[#49352f]">
                  {editingId ? "Edit promotion" : "Create promotion"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving || previewLoading}
                aria-label="Close promotion form"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f8f5f1] text-xl text-[#49352f] hover:bg-[#f0e7e1]"
              >
                Ã—
              </button>
            </div>

            <form onSubmit={savePromotion}>
              <div className="max-h-[calc(100vh-190px)] space-y-8 overflow-y-auto p-5 sm:p-7">
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <section>
                  <SectionHeading
                    title="Promotion details"
                    description="Give your campaign a clear name and describe the offer."
                  />

                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-[#49352f]">
                        Promotion name *
                      </span>
                      <input
                        required
                        maxLength={200}
                        value={form.name}
                        onChange={(event) => updateForm("name", event.target.value)}
                        placeholder="e.g. BigFred Weekend Beauty Sale"
                        className={inputClass}
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-[#49352f]">
                        Description
                      </span>
                      <textarea
                        rows={3}
                        value={form.description}
                        onChange={(event) =>
                          updateForm("description", event.target.value)
                        }
                        placeholder="Describe this promotion for your team..."
                        className={inputClass}
                      />
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-[#eee5df] bg-white p-4">
                      <input
                        type="checkbox"
                        checked={form.is_enabled}
                        onChange={(event) =>
                          updateForm("is_enabled", event.target.checked)
                        }
                        className="h-4 w-4 accent-[#a66c72]"
                      />
                      <span>
                        <span className="block text-sm font-medium text-[#49352f]">
                          Enable promotion
                        </span>
                        <span className="mt-1 block text-xs text-gray-400">
                          Allow this campaign to apply during its scheduled dates.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-[#eee5df] bg-white p-4">
                      <input
                        type="checkbox"
                        checked={form.can_combine}
                        onChange={(event) =>
                          updateForm("can_combine", event.target.checked)
                        }
                        className="h-4 w-4 accent-[#a66c72]"
                      />
                      <span>
                        <span className="block text-sm font-medium text-[#49352f]">
                          Allow combination
                        </span>
                        <span className="mt-1 block text-xs text-gray-400">
                          Allow this promotion to combine with other combinable offers.
                        </span>
                      </span>
                    </label>
                  </div>
                </section>

                <div className="border-t border-[#eee5df]" />

                <section>
                  <SectionHeading
                    title="Global discount"
                    description="Set a discount that applies across eligible products. Product rules can override it."
                  />

                  <div className="grid gap-5 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#49352f]">
                        Discount type
                      </span>
                      <select
                        value={form.discount_type}
                        onChange={(event) =>
                          updateForm(
                            "discount_type",
                            event.target.value as PromotionForm["discount_type"]
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">No global discount</option>
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed amount</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#49352f]">
                        Discount value
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={form.discount_type === "percentage" ? 100 : undefined}
                        disabled={!form.discount_type}
                        value={form.discount_value}
                        onChange={(event) =>
                          updateForm("discount_value", event.target.value)
                        }
                        placeholder={
                          form.discount_type === "percentage" ? "10" : "25.00"
                        }
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#49352f]">
                        Discount application
                      </span>
                      <select
                        value={form.discount_application}
                        onChange={(event) =>
                          updateForm(
                            "discount_application",
                            event.target.value as "per_unit" | "per_order"
                          )
                        }
                        disabled={!form.discount_type}
                        className={inputClass}
                      >
                        <option value="per_unit">Per unit</option>
                        <option value="per_order">Per order</option>
                      </select>
                    </label>
                  </div>

                  <p className="mt-3 text-xs text-gray-400">
                    Per unit applies the fixed amount to each eligible quantity.
                    Per order applies the fixed amount once to the order.
                  </p>
                </section>

                <div className="border-t border-[#eee5df]" />

                <section>
                  <SectionHeading
                    title="Product eligibility"
                    description="Choose whether this offer applies to the full catalogue or selected products."
                  />

                  <label className="flex items-start gap-3 rounded-xl border border-[#eee5df] bg-white p-4">
                    <input
                      type="checkbox"
                      checked={form.applies_to_all_products}
                      onChange={(event) =>
                        updateForm("applies_to_all_products", event.target.checked)
                      }
                      className="mt-1 h-4 w-4 accent-[#a66c72]"
                    />
                    <span>
                      <span className="block text-sm font-medium text-[#49352f]">
                        Apply to all products
                      </span>
                      <span className="mt-1 block text-xs text-gray-400">
                        The global discount will apply to all eligible products.
                        Specific product rules below override the global discount.
                      </span>
                    </span>
                  </label>

                  {!form.applies_to_all_products && (
                    <p className="mt-3 text-xs text-[#a66c72]">
                      Select at least one product below.
                    </p>
                  )}

                  <div className="mt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-[#49352f]">
                          Product-specific rules
                        </h4>
                        <p className="mt-1 text-xs text-gray-400">
                          These settings override the global discount for the selected product.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addProductRule}
                        className={secondaryButton}
                      >
                        + Add product rule
                      </button>
                    </div>

                    {form.products.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#e5d8d0] bg-white p-6 text-center text-sm text-gray-400">
                        No product-specific rules added.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {form.products.map((rule, index) => (
                          <div
                            key={index}
                            className="grid gap-3 rounded-xl border border-[#eee5df] bg-white p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                          >
                            <label className="block">
                              <span className="mb-2 block text-xs font-medium text-gray-500">
                                Product
                              </span>
                              <select
                                required
                                value={rule.product_id}
                                onChange={(event) =>
                                  updateProductRule(index, "product_id", event.target.value)
                                }
                                className={inputClass}
                              >
                                <option value="">Select product</option>
                                {products.map((product) => (
                                  <option
                                    key={product.id}
                                    value={product.id}
                                    disabled={form.products.some(
                                      (other, otherIndex) =>
                                        otherIndex !== index &&
                                        other.product_id === String(product.id)
                                    )}
                                  >
                                    {product.name} â€” {formatMoney(product.price)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-xs font-medium text-gray-500">
                                Discount type
                              </span>
                              <select
                                value={rule.discount_type}
                                onChange={(event) =>
                                  updateProductRule(
                                    index,
                                    "discount_type",
                                    event.target.value
                                  )
                                }
                                className={inputClass}
                              >
                                <option value="">No override</option>
                                <option value="percentage">Percentage</option>
                                <option value="fixed">Fixed</option>
                              </select>
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-xs font-medium text-gray-500">
                                Value
                              </span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                max={rule.discount_type === "percentage" ? 100 : undefined}
                                value={rule.discount_value}
                                onChange={(event) =>
                                  updateProductRule(index, "discount_value", event.target.value)
                                }
                                disabled={!rule.discount_type}
                                placeholder="Value"
                                className={inputClass}
                              />
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-xs font-medium text-gray-500">
                                Application
                              </span>
                              <select
                                value={rule.discount_application}
                                onChange={(event) =>
                                  updateProductRule(
                                    index,
                                    "discount_application",
                                    event.target.value
                                  )
                                }
                                disabled={!rule.discount_type}
                                className={inputClass}
                              >
                                <option value="per_unit">Per unit</option>
                                <option value="per_order">Per order</option>
                              </select>
                            </label>

                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => removeProductRule(index)}
                                className="w-full rounded-xl border border-red-100 px-3 py-3 text-sm text-red-600 hover:bg-red-50 xl:w-auto"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <div className="border-t border-[#eee5df]" />

                <section>
                  <SectionHeading
                    title="Free delivery"
                    description="Optionally waive delivery fees for selected delivery zones."
                  />

                  <label className="flex items-center gap-3 rounded-xl border border-[#eee5df] bg-white p-4">
                    <input
                      type="checkbox"
                      checked={form.free_delivery}
                      onChange={(event) =>
                        updateForm("free_delivery", event.target.checked)
                      }
                      className="h-4 w-4 accent-[#a66c72]"
                    />
                    <span>
                      <span className="block text-sm font-medium text-[#49352f]">
                        Offer free delivery
                      </span>
                      <span className="mt-1 block text-xs text-gray-400">
                        Customers in selected delivery zones will receive free delivery.
                      </span>
                    </span>
                  </label>

                  {form.free_delivery && (
                    <div className="mt-4 rounded-xl border border-[#eee5df] bg-white p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-[#49352f]">
                          Eligible delivery zones
                        </h4>
                        <span className="text-xs text-gray-400">
                          {form.delivery_zone_ids.length} selected
                        </span>
                      </div>

                      {zones.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No active delivery zones are available.
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {zones.map((zone) => (
                            <label
                              key={zone.id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#eee5df] p-3 hover:bg-[#fdfbf9]"
                            >
                              <input
                                type="checkbox"
                                checked={form.delivery_zone_ids.includes(String(zone.id))}
                                onChange={() => toggleZone(String(zone.id))}
                                className="h-4 w-4 accent-[#a66c72]"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-[#49352f]">
                                  {zone.name}
                                </span>
                                <span className="block text-xs text-gray-400">
                                  Usual fee: {formatMoney(zone.delivery_fee)}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <div className="border-t border-[#eee5df]" />

                <section>
                  <SectionHeading
                    title="Minimum order and schedule"
                    description="Set any minimum spend and define when the promotion is valid."
                  />

                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#49352f]">
                        Minimum order value (GHS)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.minimum_order_value}
                        onChange={(event) =>
                          updateForm("minimum_order_value", event.target.value)
                        }
                        placeholder="No minimum"
                        className={inputClass}
                      />
                    </label>

                    <div className="hidden md:block" />

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#49352f]">
                        Starts at *
                      </span>
                      <input
                        type="datetime-local"
                        required
                        value={form.starts_at}
                        onChange={(event) => updateForm("starts_at", event.target.value)}
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#49352f]">
                        Ends at *
                      </span>
                      <input
                        type="datetime-local"
                        required
                        value={form.ends_at}
                        onChange={(event) => updateForm("ends_at", event.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </section>

                <div className="border-t border-[#eee5df]" />

                <section>
                  <SectionHeading
                    title="Promotion preview"
                    description="Test the campaign against a sample order using the actual Laravel pricing engine."
                  />

                  <div className="rounded-2xl border border-[#eee5df] bg-white p-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="block">
                        <span className="mb-2 block text-xs font-medium text-gray-500">
                          Sample product
                        </span>
                        <select
                          value={previewProductId}
                          onChange={(event) => setPreviewProductId(event.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select a product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-medium text-gray-500">
                          Quantity
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={previewQuantity}
                          onChange={(event) => setPreviewQuantity(event.target.value)}
                          className={inputClass}
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-xs font-medium text-gray-500">
                          Delivery zone
                        </span>
                        <select
                          value={previewZoneId}
                          onChange={(event) => setPreviewZoneId(event.target.value)}
                          className={inputClass}
                        >
                          <option value="">No delivery zone</option>
                          {zones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={runPreview}
                      disabled={previewLoading || products.length === 0}
                      className={`${secondaryButton} mt-4`}
                    >
                      {previewLoading ? "Calculating..." : "Calculate preview"}
                    </button>

                    {preview && (
                      <div className="mt-5 rounded-xl bg-[#f8f5f1] p-5">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <h4 className="font-serif text-lg text-[#49352f]">
                            Estimated order total
                          </h4>
                          <span className="text-xs text-gray-500">
                            {preview.delivery_zone_name || "No delivery zone"}
                          </span>
                        </div>

                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="font-medium text-[#49352f]">
                              {formatMoney(preview.subtotal)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Product discount</span>
                            <span className="font-medium text-green-700">
                              âˆ’{formatMoney(preview.product_discount_amount)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Original delivery fee</span>
                            <span className="text-[#49352f]">
                              {formatMoney(preview.original_delivery_fee)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Delivery discount</span>
                            <span className="font-medium text-green-700">
                              âˆ’{formatMoney(preview.delivery_discount_amount)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-4">
                            <span className="text-gray-500">Delivery fee after discount</span>
                            <span className="text-[#49352f]">
                              {formatMoney(preview.delivery_fee)}
                            </span>
                          </div>

                          <div className="border-t border-[#e9dfd8] pt-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-semibold text-[#49352f]">
                                Estimated total
                              </span>
                              <span className="text-xl font-semibold text-[#a66c72]">
                                {formatMoney(preview.total)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {preview.delivery_quote_pending && (
                          <p className="mt-3 text-xs text-amber-700">
                            Delivery quote is pending.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 flex flex-col-reverse justify-between gap-3 border-t border-[#eee5df] bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-7">
                <p className="text-xs text-gray-400">
                  Changes are saved to the BigFred promotion system.
                </p>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving || previewLoading}
                    className={secondaryButton}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving || previewLoading}
                    className={primaryButton}
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Save changes"
                        : "Create promotion"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
