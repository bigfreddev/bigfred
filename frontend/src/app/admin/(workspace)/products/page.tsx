
"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import api from "@/lib/api";
import "./products-redesign.css";

type Category = {
  id: number;
  name: string;
};

type ProductImage = {
  id: number;
  image_path: string;
  is_primary: boolean;
  alt_text?: string;
  sort_order?: number;
};

type Product = {
  id: number;
  name: string;
  sku: string;
  slug: string;
  category_id: number;
  category?: Category;
  price: string | number;
  compare_at_price?: string | number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  short_description?: string;
  description?: string;
  images?: ProductImage[];
};

type ProductForm = {
  category_id: string;
  name: string;
  sku: string;
  short_description: string;
  description: string;
  price: string;
  compare_at_price: string;
  stock_quantity: string;
  low_stock_threshold: string;
  is_featured: boolean;
  is_active: boolean;
  images: File[];
  primary_image_index: number;
};

type Pagination = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

const emptyForm: ProductForm = {
  category_id: "",
  name: "",
  sku: "",
  short_description: "",
  description: "",
  price: "",
  compare_at_price: "",
  stock_quantity: "0",
  low_stock_threshold: "5",
  is_featured: false,
  is_active: true,
  images: [],
  primary_image_index: 0,
};

const initialPagination: Pagination = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 0,
  from: null,
  to: null,
};

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

function imageUrl(path?: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;

  return `http://localhost:8001/storage/${path.replace(/^\/+/, "")}`;
}

function isAuthError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;

  return (
    error.response?.status === 401 ||
    error.response?.status === 403
  );
}

type ApiErrorResponse = {
  errors?: Record<string, string[]>;
  message?: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  const responseData = isAxiosError<ApiErrorResponse>(error)
    ? error.response?.data
    : undefined;

  const validationErrors = responseData?.errors;

  const firstError = validationErrors
    ? Object.values(validationErrors).flat()[0]
    : null;

  return String(firstError || responseData?.message || fallback);
}

export default function ProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] =
    useState<Pagination>(initialPagination);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageActionId, setImageActionId] = useState<number | null>(null);
  const [statusActionId, setStatusActionId] = useState<number | null>(null);

  const loadData = useCallback(
    async (page = currentPage) => {
      setLoading(true);
      setError("");

      try {
        const [productResponse, categoryResponse] = await Promise.all([
          api.get("/admin/products", {
            params: {
              search: search || undefined,
              category_id: categoryFilter || undefined,
              stock: stockFilter || undefined,
              status: statusFilter || undefined,
              page,
            },
          }),
          api.get("/admin/categories"),
        ]);

        const productPayload = productResponse.data?.data;
        const rows = getRows<Product>(productResponse);

        setProducts(rows);
        setCategories(getRows<Category>(categoryResponse));

        if (productPayload && !Array.isArray(productPayload)) {
          setPagination({
            current_page: Number(productPayload.current_page || page),
            last_page: Number(productPayload.last_page || 1),
            per_page: Number(productPayload.per_page || 15),
            total: Number(productPayload.total || 0),
            from: productPayload.from ?? null,
            to: productPayload.to ?? null,
          });
        } else {
          setPagination({
            ...initialPagination,
            current_page: page,
            total: rows.length,
            from: rows.length ? 1 : null,
            to: rows.length || null,
          });
        }
      } catch (err: unknown) {
        if (isAuthError(err)) {
          router.replace("/admin/login");
          return;
        }

        setError(
          getErrorMessage(err, "Unable to load products. Please try again.")
        );
      } finally {
        setLoading(false);
      }
    },
    [
      router,
      search,
      categoryFilter,
      stockFilter,
      statusFilter,
      currentPage,
    ]
  );

  useEffect(() => {
    // Starts the asynchronous product and category requests.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(currentPage);
  }, [loadData, currentPage]);

  // Generate temporary preview URLs for selected product images.
  useEffect(() => {
    console.log("PREVIEW EFFECT — image count:", form.images.length);

    const previews = form.images.map((file) => {
      const url = URL.createObjectURL(file);

      console.log("CREATED PREVIEW URL:", url);
      console.log("PREVIEW FILE:", file.name, file.type, file.size);

      return url;
    });

    // Synchronize preview URLs with the selected files.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImagePreviews(previews);

    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [form.images]);

  // Diagnostic: monitor the generated preview state.
  useEffect(() => {
    console.log("IMAGE PREVIEWS STATE:", imagePreviews);
  }, [imagePreviews]);

  const updateField = <K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
  };

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowModal(true);
    setNotice("");
    setError("");
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);

    setForm({
      ...emptyForm,
      category_id: String(product.category_id),
      name: product.name,
      sku: product.sku || "",
      short_description: product.short_description || "",
      description: product.description || "",
      price: String(product.price),
      compare_at_price: product.compare_at_price
        ? String(product.compare_at_price)
        : "",
      stock_quantity: String(product.stock_quantity),
      low_stock_threshold: String(product.low_stock_threshold),
      is_featured: product.is_featured,
      is_active: product.is_active,
      images: [],
      primary_image_index: -1,
    });

    setShowModal(true);
    setNotice("");
    setError("");
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      form.compare_at_price &&
      Number(form.compare_at_price) <= Number(form.price)
    ) {
      setError("Compare-at price must be greater than the selling price.");
      return;
    }

    if (form.images.length > 10) {
      setError("You can upload a maximum of 10 images at a time.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = new FormData();

      payload.append("category_id", form.category_id);
      payload.append("name", form.name);
      payload.append("sku", form.sku);
      payload.append("short_description", form.short_description);
      payload.append("description", form.description);
      payload.append("price", form.price);
      payload.append("compare_at_price", form.compare_at_price);
      payload.append("stock_quantity", form.stock_quantity);
      payload.append("low_stock_threshold", form.low_stock_threshold);
      payload.append("is_featured", form.is_featured ? "1" : "0");
      payload.append("is_active", form.is_active ? "1" : "0");

      form.images.forEach((file) => {
        payload.append("images[]", file);
      });

      if (
        form.images.length > 0 &&
        (!editingProduct || form.primary_image_index >= 0)
      ) {
        payload.append(
          "primary_image_index",
          String(
            editingProduct
              ? form.primary_image_index
              : Math.max(0, form.primary_image_index)
          )
        );
      }

      if (editingProduct) {
        await api.post(
          `/admin/products/${editingProduct.id}`,
          payload,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        setNotice("Product updated successfully.");
      } else {
        await api.post("/admin/products", payload, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        setNotice("Product created successfully.");
      }

      setShowModal(false);
      setEditingProduct(null);
      setForm(emptyForm);

      await loadData(currentPage);
    } catch (err: unknown) {
      if (isAuthError(err)) {
        router.replace("/admin/login");
        return;
      }

      setError(getErrorMessage(err, "Unable to save product."));
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    const confirmed = window.confirm(
      `Are you sure you want to move "${product.name}" to deleted items?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await api.delete(`/admin/products/${product.id}`);

      setNotice("Product moved to deleted items successfully.");

      const nextPage =
        products.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;

      if (nextPage !== currentPage) {
        setCurrentPage(nextPage);
      } else {
        await loadData(currentPage);
      }
    } catch (err: unknown) {
      if (isAuthError(err)) {
        router.replace("/admin/login");
        return;
      }

      setError(
        getErrorMessage(err, "Unable to delete this product.")
      );
    }
  };

  const toggleProductStatus = async (product: Product) => {
    setStatusActionId(product.id);
    setError("");
    setNotice("");

    try {
      await api.post(`/admin/products/${product.id}`, {
        is_active: product.is_active ? 0 : 1,
      });

      setNotice(
        product.is_active
          ? "Product deactivated successfully."
          : "Product activated successfully."
      );

      await loadData(currentPage);
    } catch (err: unknown) {
      if (isAuthError(err)) {
        router.replace("/admin/login");
        return;
      }

      setError(
        getErrorMessage(err, "Unable to update product status.")
      );
    } finally {
      setStatusActionId(null);
    }
  };

  const setPrimaryImage = async (image: ProductImage) => {
    if (!editingProduct) return;

    setImageActionId(image.id);
    setError("");
    setNotice("");

    try {
      const response = await api.patch(
        `/admin/products/${editingProduct.id}/images/${image.id}/primary`
      );

      const updatedImages: ProductImage[] =
        response.data?.data?.images || [];

      const updatedProduct = {
        ...editingProduct,
        images: updatedImages,
      };

      setEditingProduct(updatedProduct);

      setProducts((previous) =>
        previous.map((product) =>
          product.id === editingProduct.id
            ? { ...product, images: updatedImages }
            : product
        )
      );

      setNotice("Primary image updated successfully.");
    } catch (err: unknown) {
      if (isAuthError(err)) {
        router.replace("/admin/login");
        return;
      }

      setError(
        getErrorMessage(err, "Unable to update the primary image.")
      );
    } finally {
      setImageActionId(null);
    }
  };

  const deleteImage = async (image: ProductImage) => {
    if (!editingProduct) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this product image?"
    );

    if (!confirmed) return;

    setImageActionId(image.id);
    setError("");
    setNotice("");

    try {
      const response = await api.delete(
        `/admin/products/${editingProduct.id}/images/${image.id}`
      );

      const updatedImages: ProductImage[] =
        response.data?.data?.images || [];

      const updatedProduct = {
        ...editingProduct,
        images: updatedImages,
      };

      setEditingProduct(updatedProduct);

      setProducts((previous) =>
        previous.map((product) =>
          product.id === editingProduct.id
            ? { ...product, images: updatedImages }
            : product
        )
      );

      setNotice("Product image deleted successfully.");
    } catch (err: unknown) {
      if (isAuthError(err)) {
        router.replace("/admin/login");
        return;
      }

      setError(
        getErrorMessage(err, "Unable to delete this image.")
      );
    } finally {
      setImageActionId(null);
    }
  };

  const changePage = (page: number) => {
    if (
      page < 1 ||
      page > pagination.last_page ||
      page === currentPage
    ) {
      return;
    }

    setCurrentPage(page);
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setStockFilter("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const activeCount = products.filter(
    (product) => product.is_active
  ).length;

  const lowStockCount = products.filter(
    (product) =>
      product.stock_quantity > 0 &&
      product.stock_quantity <= product.low_stock_threshold
  ).length;

  const outOfStockCount = products.filter(
    (product) => product.stock_quantity <= 0
  ).length;

  const formatPrice = (price: string | number) =>
    `GH₵ ${Number(price).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const inputClass =
    "w-full rounded-xl border border-[#eee5df] bg-[#fcfaf8] px-4 py-3 text-sm text-[#49352f] outline-none transition placeholder:text-gray-400 focus:border-[#c58c91] focus:ring-2 focus:ring-[#c58c91]/10";

  const labelClass =
    "block space-y-2 text-sm font-medium text-[#49352f]";

  const stats = [
    {
      label: "Products shown",
      value: products.length,
      detail: "Products on this page",
      icon: "◇",
    },
    {
      label: "Active products",
      value: activeCount,
      detail: "Visible in storefront",
      icon: "✓",
    },
    {
      label: "Low stock",
      value: lowStockCount,
      detail: "Requires attention",
      icon: "!",
    },
    {
      label: "Out of stock",
      value: outOfStockCount,
      detail: "Currently unavailable",
      icon: "×",
    },
  ];

  return (
    <div className="bf-products-page">
      <div className="bf-products-inner">

        {/* Page heading */}
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[#a66c72]">
              Store management
            </p>

            <h1 className="mt-2 font-serif text-3xl md:text-4xl">
              Products
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage your beauty collection, pricing and inventory.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-[#49352f] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#35251f]"
          >
            + Add New Product
          </button>
        </div>

        {/* Feedback messages */}
        {notice && (
          <div
            role="status"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            <span>{notice}</span>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
              className="text-lg"
            >
              ×
            </button>
          </div>
        )}

        {error && !showModal && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="text-lg"
            >
              ×
            </button>
          </div>
        )}

        {/* Summary cards */}
        <section className="bf-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="bf-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {stat.label}
                  </p>

                  <p className="mt-3 text-3xl font-semibold tracking-tight text-[#49352f]">
                    {stat.value}
                  </p>

                  <p className="mt-1.5 text-xs text-gray-400">
                    {stat.detail}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6e9e7] text-xl font-semibold text-[#a66c72]">
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Inventory section */}
        <section className="overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-sm">

          {/* Inventory heading */}
          <div className="flex flex-col justify-between gap-4 border-b border-[#f0eae5] p-6 md:flex-row md:items-center">
            <div>
              <h2 className="font-serif text-xl">
                Product inventory
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Search, filter and manage your store products.
              </p>
            </div>

            <span className="rounded-full bg-[#f8f5f1] px-3 py-1.5 text-xs font-medium text-[#a66c72]">
              {pagination.total}{" "}
              {pagination.total === 1 ? "product" : "products"}
            </span>
          </div>

          {/* Search and filters */}
          <div className="border-b border-[#f0eae5] bg-white p-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name or SKU..."
                aria-label="Search products"
                className={inputClass}
              />

              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by category"
                className={inputClass}
              >
                <option value="">All categories</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={stockFilter}
                onChange={(event) => {
                  setStockFilter(event.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by stock level"
                className={inputClass}
              >
                <option value="">All stock levels</option>
                <option value="in">In stock</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by product status"
                className={inputClass}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {(search || categoryFilter || stockFilter || statusFilter) && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-medium text-[#a66c72] transition hover:text-[#49352f]"
                >
                  Clear all filters ×
                </button>
              </div>
            )}
          </div>

          {/* Product table */}
          {loading ? (
            <div className="p-16 text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[#eee5df] border-t-[#a66c72]" />

              <p className="text-sm font-medium text-gray-500">
                Loading products...
              </p>
            </div>
          ) : products.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f6e9e7] text-3xl text-[#a66c72]">
                ✦
              </div>

              <h3 className="font-serif text-xl">
                No products found
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
                Add your first product or adjust your search filters
                to see matching products.
              </p>

              <button
                type="button"
                onClick={openCreate}
                className="mt-5 rounded-xl bg-[#49352f] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#35251f]"
              >
                Add a product
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left">
                  <thead className="border-b border-[#eee5df] bg-[#fcfaf8]">
                    <tr className="text-xs uppercase tracking-wider text-gray-400">
                      <th className="px-5 py-4 font-medium">Product</th>
                      <th className="px-5 py-4 font-medium">Category</th>
                      <th className="px-5 py-4 font-medium">Price</th>
                      <th className="px-5 py-4 font-medium">Stock</th>
                      <th className="px-5 py-4 font-medium">Status</th>
                      <th className="px-5 py-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#f0eae5]">
                    {products.map((product) => {
                      const primaryImage =
                        product.images?.find(
                          (image) => image.is_primary
                        ) || product.images?.[0];

                      const isOut = product.stock_quantity <= 0;

                      const isLow =
                        !isOut &&
                        product.stock_quantity <=
                          product.low_stock_threshold;

                      return (
                        <tr
                          key={product.id}
                          className="transition hover:bg-[#fdfbf9]"
                        >
                          {/* Product */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[#eee5df] bg-[#fcfaf8]">
                                {primaryImage ? (
                                  <Image
                                    src={imageUrl(primaryImage.image_path)}
                                    alt={product.name}
                                    fill
                                    unoptimized
                                    sizes="56px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xl text-[#a66c72]">
                                    ✦
                                  </div>
                                )}

                                {product.images &&
                                  product.images.length > 1 && (
                                    <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                                      {product.images.length} images
                                    </span>
                                  )}
                              </div>

                              <div className="min-w-0">
                                <p className="max-w-[230px] truncate text-sm font-medium text-[#49352f]">
                                  {product.name}
                                </p>

                                <p className="mt-1 text-xs text-gray-400">
                                  SKU: {product.sku || "Not assigned"}
                                </p>

                                {product.is_featured && (
                                  <span className="mt-1.5 inline-flex rounded-full bg-[#f6e9e7] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#a66c72]">
                                    Featured
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-5 py-4 text-sm text-gray-500">
                            {product.category?.name ||
                              categories.find(
                                (category) =>
                                  category.id === product.category_id
                              )?.name ||
                              "—"}
                          </td>

                          {/* Price */}
                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-[#49352f]">
                              {formatPrice(product.price)}
                            </p>

                            {product.compare_at_price && (
                              <p className="mt-1 text-xs text-gray-400 line-through">
                                {formatPrice(product.compare_at_price)}
                              </p>
                            )}
                          </td>

                          {/* Stock */}
                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-[#49352f]">
                              {product.stock_quantity}
                            </p>

                            <span
                              className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
                                isOut
                                  ? "bg-red-50 text-red-600"
                                  : isLow
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-green-50 text-green-700"
                              }`}
                            >
                              {isOut
                                ? "Out of stock"
                                : isLow
                                  ? "Low stock"
                                  : "In stock"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium ${
                                product.is_active
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {product.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(product)}
                                className="rounded-lg border border-[#eee5df] bg-white px-3.5 py-2 text-xs font-medium text-[#49352f] transition hover:bg-[#fcfaf8]"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={statusActionId === product.id}
                                onClick={() =>
                                  toggleProductStatus(product)
                                }
                                className="rounded-lg border border-[#eee5df] bg-white px-3 py-2 text-xs font-medium text-[#a66c72] transition hover:bg-[#f8f0ed] disabled:opacity-50"
                              >
                                {statusActionId === product.id
                                  ? "Updating..."
                                  : product.is_active
                                    ? "Deactivate"
                                    : "Activate"}
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteProduct(product)}
                                className="rounded-lg border border-red-100 bg-white px-3.5 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col justify-between gap-4 border-t border-[#f0eae5] px-6 py-5 sm:flex-row sm:items-center">
                <p className="text-xs text-gray-500">
                  Showing{" "}
                  <span className="font-medium text-[#49352f]">
                    {pagination.from ?? 0}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-[#49352f]">
                    {pagination.to ?? 0}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-[#49352f]">
                    {pagination.total}
                  </span>{" "}
                  products
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => changePage(currentPage - 1)}
                    className="rounded-lg border border-[#eee5df] px-3.5 py-2 text-xs font-medium text-[#49352f] transition hover:bg-[#fcfaf8] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="min-w-[90px] text-center text-xs text-gray-500">
                    Page {pagination.current_page} of{" "}
                    {pagination.last_page}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= pagination.last_page}
                    onClick={() => changePage(currentPage + 1)}
                    className="rounded-lg border border-[#eee5df] px-3.5 py-2 text-xs font-medium text-[#49352f] transition hover:bg-[#fcfaf8] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <footer className="py-8 text-center text-xs text-gray-400">
          BigFred Product Management
        </footer>
      </div>

      {/* Create / edit product modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="my-6 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            {/* Modal heading */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#eee5df] bg-white p-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#a66c72]">
                  Product management
                </p>

                <h2 className="mt-1 font-serif text-2xl">
                  {editingProduct ? "Edit product" : "Add new product"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter product information and manage its images.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close product form"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f8f0ed] text-xl text-[#49352f] transition hover:bg-[#f1e5e1]"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitProduct} className="space-y-7 p-6">

              {/* Modal error */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {/* Basic details */}
              <section className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg text-[#49352f]">
                    Product information
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    Basic details customers will see in your store.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className={labelClass}>
                    Product name *
                    <input
                      required
                      maxLength={150}
                      value={form.name}
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                      placeholder="e.g. Radiance Body Oil"
                      className={inputClass}
                    />
                  </label>

                  <label className={labelClass}>
                    Category *
                    <select
                      required
                      value={form.category_id}
                      onChange={(event) =>
                        updateField("category_id", event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Select category</option>

                      {categories.map((category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={labelClass}>
                    SKU
                    <input
                      value={form.sku}
                      onChange={(event) =>
                        updateField("sku", event.target.value)
                      }
                      placeholder="Leave blank to generate automatically"
                      className={inputClass}
                    />
                  </label>

                  <label className={labelClass}>
                    Price (GH₵) *
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(event) =>
                        updateField("price", event.target.value)
                      }
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </label>

                  <label className={labelClass}>
                    Compare-at price (GH₵)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.compare_at_price}
                      onChange={(event) =>
                        updateField(
                          "compare_at_price",
                          event.target.value
                        )
                      }
                      placeholder="Optional original price"
                      className={inputClass}
                    />
                  </label>

                  <label className={labelClass}>
                    Stock quantity *
                    <input
                      required
                      type="number"
                      min="0"
                      value={form.stock_quantity}
                      onChange={(event) =>
                        updateField(
                          "stock_quantity",
                          event.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </label>

                  <label className={labelClass}>
                    Low-stock alert threshold
                    <input
                      type="number"
                      min="0"
                      value={form.low_stock_threshold}
                      onChange={(event) =>
                        updateField(
                          "low_stock_threshold",
                          event.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
              </section>

              <div className="border-t border-[#f0eae5]" />

              {/* Descriptions */}
              <section className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg text-[#49352f]">
                    Product descriptions
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    Explain the product and its benefits.
                  </p>
                </div>

                <label className={labelClass}>
                  Short description
                  <input
                    maxLength={500}
                    value={form.short_description}
                    onChange={(event) =>
                      updateField(
                        "short_description",
                        event.target.value
                      )
                    }
                    placeholder="A short description for product cards"
                    className={inputClass}
                  />
                </label>

                <label className={labelClass}>
                  Full description
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    placeholder="Describe the product, its benefits and how to use it..."
                    className={`${inputClass} resize-y`}
                  />
                </label>
              </section>

              <div className="border-t border-[#f0eae5]" />

              {/* Existing images */}
              {editingProduct && (
                <section className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-serif text-lg text-[#49352f]">
                        Current product images
                      </h3>

                      <span className="rounded-full bg-[#f8f5f1] px-3 py-1 text-xs text-[#a66c72]">
                        {editingProduct.images?.length || 0} images
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-gray-400">
                      Select a primary image or remove images you no longer need.
                    </p>
                  </div>

                  {editingProduct.images &&
                  editingProduct.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                      {editingProduct.images.map((image) => (
                        <div
                          key={image.id}
                          className={`overflow-hidden rounded-xl border-2 bg-white ${
                            image.is_primary
                              ? "border-[#c58c91]"
                              : "border-[#eee5df]"
                          }`}
                        >
                          <div className="relative">
                            <Image
                              src={imageUrl(image.image_path)}
                              alt={image.alt_text || editingProduct.name}
                              width={400}
                              height={300}
                              unoptimized
                              className="h-32 w-full object-cover"
                            />

                            {image.is_primary && (
                              <span className="absolute left-2 top-2 rounded-full bg-[#49352f] px-2.5 py-1 text-[10px] font-medium text-white">
                                Primary
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 p-2">
                            {!image.is_primary && (
                              <button
                                type="button"
                                disabled={imageActionId === image.id}
                                onClick={() => setPrimaryImage(image)}
                                className="w-full rounded-lg bg-[#f6e9e7] px-2 py-2 text-[11px] font-medium text-[#a66c72] transition hover:bg-[#f1e5e1] disabled:opacity-50"
                              >
                                {imageActionId === image.id
                                  ? "Updating..."
                                  : "Set as primary"}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={imageActionId === image.id}
                              onClick={() => deleteImage(image)}
                              className="w-full rounded-lg border border-red-100 px-2 py-2 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {imageActionId === image.id
                                ? "Please wait..."
                                : "Remove image"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#e5d8d0] bg-[#fcfaf8] p-8 text-center">
                      <p className="text-sm text-gray-500">
                        This product does not have any images yet.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* Upload images */}
              <section className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg text-[#49352f]">
                    {editingProduct ? "Add more images" : "Product images"}
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    JPG, PNG or WEBP. Maximum 10 images per upload,
                    5 MB each.
                  </p>
                </div>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(
                      event.currentTarget.files ?? []
                    ).slice(0, 10);

                    console.log("DHYSEM IMAGE INPUT FIRED");
                    console.log("Selected files:", files);
                    console.log("File count:", files.length);

                    setForm((previous) => ({
                      ...previous,
                      images: files,
                      primary_image_index: editingProduct ? -1 : 0,
                    }));

                    console.log(
                      "Files added to product form:",
                      files.length
                    );
                  }}
                  className="block w-full rounded-xl border border-dashed border-[#e5d8d0] bg-[#fcfaf8] p-4 text-sm text-[#49352f] file:mr-4 file:rounded-lg file:border-0 file:bg-[#f6e9e7] file:px-4 file:py-2 file:text-xs file:font-medium file:text-[#a66c72] hover:file:bg-[#f1e5e1]"
                />

                {form.images.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      {form.images.length} new{" "}
                      {form.images.length === 1 ? "image" : "images"} selected.
                      {editingProduct
                        ? " Select one if you want a new upload to become the primary image."
                        : " Select the image you want displayed first."}
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {form.images.map((file, index) => (
                        <button
                          type="button"
                          key={`${file.name}-${index}`}
                          onClick={() =>
                            updateField(
                              "primary_image_index",
                              index
                            )
                          }
                          className={`overflow-hidden rounded-xl border-2 bg-white text-left transition ${
                            form.primary_image_index === index
                              ? "border-[#c58c91] shadow-[0_0_0_3px_rgba(197,140,145,0.12)]"
                              : "border-[#eee5df] hover:border-[#c58c91]"
                          }`}
                        >
                          {imagePreviews[index] && (
                            <img
                              src={imagePreviews[index]}
                              alt={file.name}
                              className="h-28 w-full object-cover"
                            />
                          )}

                          <span className="block truncate p-2 text-xs font-medium text-[#49352f]">
                            {form.primary_image_index === index
                              ? "✓ Primary image"
                              : "Set as primary"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div className="border-t border-[#f0eae5]" />

              {/* Product settings */}
              <section className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg text-[#49352f]">
                    Product visibility
                  </h3>

                  <p className="mt-1 text-xs text-gray-400">
                    Control how this product appears in your storefront.
                  </p>
                </div>

                <div className="flex flex-wrap gap-6 rounded-xl border border-[#eee5df] bg-[#fcfaf8] p-4">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#49352f]">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) =>
                        updateField("is_active", event.target.checked)
                      }
                      className="h-4 w-4 accent-[#a66c72]"
                    />
                    Active product
                  </label>

                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#49352f]">
                    <input
                      type="checkbox"
                      checked={form.is_featured}
                      onChange={(event) =>
                        updateField("is_featured", event.target.checked)
                      }
                      className="h-4 w-4 accent-[#a66c72]"
                    />
                    Featured product
                  </label>
                </div>
              </section>

              {/* Form actions */}
              <div className="flex flex-wrap justify-end gap-3 border-t border-[#eee5df] pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-[#eee5df] bg-white px-5 py-3 text-sm font-medium text-[#49352f] transition hover:bg-[#fcfaf8] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#49352f] px-7 py-3 text-sm font-medium text-white transition hover:bg-[#35251f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingProduct
                      ? "Save changes"
                      : "Create product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
