
"use client";
import Image from "next/image";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  is_active: boolean;
  sort_order: number;
  products_count: number;
};

type CategoryForm = {
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

const emptyForm: CategoryForm = {
  name: "",
  description: "",
  is_active: true,
  sort_order: 0,
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function AdminCategories() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);

  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imagePreviewUrlRef = useRef<string | null>(null);

  const updateImagePreview = (file: File | null) => {
    if (imagePreviewUrlRef.current) {
      URL.revokeObjectURL(imagePreviewUrlRef.current);
    }

    const nextPreview = file ? URL.createObjectURL(file) : null;

    imagePreviewUrlRef.current = nextPreview;
    setImagePreview(nextPreview);
  };

  // Release the active preview URL when this component unmounts.
  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) {
        URL.revokeObjectURL(imagePreviewUrlRef.current);
        imagePreviewUrlRef.current = null;
      }
    };
  }, []);

  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const apiOrigin =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
    "http://localhost:8001";

  const getImageUrl = (image: string) => {
    if (image.startsWith("http")) return image;

    return `${apiOrigin}/storage/${image.replace(/^\/+/, "")}`;
  };


  const handleAuthError = useCallback((err: unknown): boolean => {
    const status = isAxiosError(err) ? err.response?.status : undefined;

    if (status === 401 || status === 403) {
      router.replace("/admin/login");
      return true;
    }

    return false;
  }, [router]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/categories");
      setCategories(response.data.data || []);
    } catch (err: unknown) {
      if (handleAuthError(err)) return;

      setError(
        (isAxiosError(err) ? err.response?.data?.message : undefined) ||
          "Unable to load categories. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    // This effect initiates the initial asynchronous category request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, [fetchCategories]);

  const resetImageSelection = () => {
    setImageFile(null);
    setRemoveImage(false);
    updateImagePreview(null);
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    resetImageSelection();
    setError("");
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);

    setForm({
      name: category.name,
      description: category.description || "",
      is_active: category.is_active,
      sort_order: category.sort_order,
    });

    resetImageSelection();
    setError("");
    setShowModal(true);
  };

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Please select a JPG, PNG or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image size must not exceed 5 MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setImageFile(file);
    updateImagePreview(file);
    setRemoveImage(false);

    // Allow selecting the same file again later.
    event.target.value = "";
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    updateImagePreview(null);
    setRemoveImage(true);
    setError("");
  };

  const handleSave = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setNotice("");

    const payload = new FormData();

    payload.append("name", form.name.trim());
    payload.append("description", form.description.trim());
    payload.append("is_active", form.is_active ? "1" : "0");
    payload.append("sort_order", String(Number(form.sort_order)));

    if (imageFile) {
      payload.append("image", imageFile);
    }

    if (editingCategory) {
      // Laravel method spoofing ensures PHP receives the uploaded file.
      payload.append("_method", "PUT");

      if (removeImage && !imageFile) {
        payload.append("remove_image", "1");
      }
    }

    try {
      if (editingCategory) {
        await api.post(
          `/admin/categories/${editingCategory.id}`,
          payload,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        setNotice("Category updated successfully.");
      } else {
        await api.post("/admin/categories", payload, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        setNotice("Category created successfully.");
      }

      setShowModal(false);
      setEditingCategory(null);
      setForm(emptyForm);
      resetImageSelection();

      await fetchCategories();
    } catch (err: unknown) {
      if (handleAuthError(err)) return;

      const responseData: {
        errors?: Record<string, unknown[]>;
        message?: string;
      } | undefined = isAxiosError(err) ? err.response?.data : undefined;
      const validationErrors = responseData?.errors;
      const firstValidationError = validationErrors
        ? Object.values(validationErrors).flat()[0]
        : null;

      setError(
        String(
          firstValidationError ||
            responseData?.message ||
            "Unable to save category."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (category: Category) => {
    setError("");
    setNotice("");
    setActionLoading(category.id);

    try {
      await api.patch(`/admin/categories/${category.id}`, {
        is_active: !category.is_active,
      });

      setNotice(
        `${category.name} has been ${
          category.is_active ? "deactivated" : "activated"
        }.`
      );

      await fetchCategories();
    } catch (err: unknown) {
      if (handleAuthError(err)) return;

      setError(
        (isAxiosError(err) ? err.response?.data?.message : undefined) ||
          "Unable to update category status."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const deleteCategory = async (category: Category) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");
    setActionLoading(category.id);

    try {
      await api.delete(`/admin/categories/${category.id}`);

      setNotice("Category deleted successfully.");

      await fetchCategories();
    } catch (err: unknown) {
      if (handleAuthError(err)) return;

      setError(
        (isAxiosError(err) ? err.response?.data?.message : undefined) ||
          "Unable to delete category."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const activeCount = categories.filter(
    (category) => category.is_active
  ).length;

  const inactiveCount = categories.length - activeCount;

  const totalProducts = categories.reduce(
    (total, category) => total + Number(category.products_count || 0),
    0
  );

  const filteredCategories = categories.filter((category) => {
    const matchesSearch = `${category.name} ${
      category.description || ""
    } ${category.slug}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && category.is_active) ||
      (statusFilter === "inactive" && !category.is_active);

    return matchesSearch && matchesStatus;
  });

  const currentImage =
    imagePreview ||
    (!removeImage && editingCategory?.image
      ? getImageUrl(editingCategory.image)
      : null);

  return (
    <div className="min-h-screen bg-[#f8f5f1] text-[#49352f]">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">

        {/* Page heading */}
        <div className="mb-9 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-px w-8 bg-[#a66c72]" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a66c72]">
                Store organization
              </p>
            </div>

            <h1 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
              Category Collection
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">
              Curate the collections that define your BigFred beauty
              store. Organize products and control what customers see.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#49352f] px-6 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#35251f]"
          >
            <span className="text-lg leading-none">+</span>
            Create New Category
          </button>
        </div>

        {/* Notifications */}
        {notice && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800">
            {notice}
            <button
              onClick={() => setNotice("")}
              className="ml-4 text-lg"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}

        {error && !showModal && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-4 text-lg"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Statistics */}
        <div className="mb-9 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total collections",
              value: categories.length,
              note: "All store categories",
              symbol: "C",
            },
            {
              label: "Active collections",
              value: activeCount,
              note: "Visible in your store",
              symbol: "✓",
            },
            {
              label: "Inactive collections",
              value: inactiveCount,
              note: "Currently hidden",
              symbol: "—",
            },
            {
              label: "Products organized",
              value: totalProducts,
              note: "Across all collections",
              symbol: "P",
            },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="relative overflow-hidden rounded-2xl border border-[#eee5df] bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    {stat.label}
                  </p>
                  <h3 className="mt-4 font-serif text-3xl font-normal text-[#49352f]">
                    {stat.value}
                  </h3>
                  <p className="mt-2 text-xs text-gray-400">
                    {stat.note}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f7eeeb] font-serif text-lg text-[#a66c72]">
                  {stat.symbol}
                </div>
              </div>

              <div
                className={`absolute bottom-0 left-0 h-[3px] ${
                  index === 1
                    ? "bg-green-200"
                    : index === 2
                      ? "bg-gray-200"
                      : "bg-[#d9b4ae]"
                }`}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>

        {/* Collection workspace */}
        <section className="overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-sm">
          <div className="border-b border-[#f0eae5] p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#c58c91]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a66c72]">
                    Collection library
                  </p>
                </div>

                <h2 className="mt-2 font-serif text-2xl font-normal">
                  Your Categories
                </h2>

                <p className="mt-1 text-sm text-gray-400">
                  Manage your product collections and store visibility.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 sm:w-72">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    ⌕
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Find a category..."
                    className="w-full rounded-xl border border-[#eee5df] bg-[#fcfaf8] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#c58c91]"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-[#eee5df] bg-[#fcfaf8] px-4 py-3 text-sm text-[#49352f] outline-none focus:border-[#c58c91]"
                  aria-label="Filter categories by status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Category grid */}
          <div className="bg-[#fcfaf8] p-5 sm:p-7">
            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="overflow-hidden rounded-2xl border border-[#eee5df] bg-white"
                  >
                    <div className="h-40 animate-pulse bg-[#f2eae5]" />
                    <div className="space-y-3 p-5">
                      <div className="h-4 w-1/2 animate-pulse rounded bg-[#f2eae5]" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-[#f2eae5]" />
                      <div className="h-9 animate-pulse rounded-lg bg-[#f2eae5]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e6d8d1] bg-white px-5 py-16 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f7eeeb] font-serif text-2xl text-[#a66c72]">
                  C
                </div>

                <h3 className="mt-5 font-serif text-xl">
                  {search || statusFilter !== "all"
                    ? "No matching categories"
                    : "Your collection starts here"}
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
                  {search || statusFilter !== "all"
                    ? "Try changing your search or status filter."
                    : "Create your first category to start organizing the products in your beauty store."}
                </p>

                {!search && statusFilter === "all" && (
                  <button
                    onClick={openCreateModal}
                    className="mt-6 rounded-xl bg-[#49352f] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#35251f]"
                  >
                    + Create First Category
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCategories.map((category) => (
                  <article
                    key={category.id}
                    className="group overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="relative h-48 overflow-hidden bg-[#f4ebe7]">
                      {category.image ? (
                        <Image src={getImageUrl(category.image)} alt={category.name} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#f8f0ed] to-[#ead9d2]">
                          <span className="font-serif text-5xl text-[#bd8d8b]">
                            {category.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[#a66c72]">
                            BigFred Collection
                          </span>
                        </div>
                      )}

                      <div className="absolute left-4 top-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider shadow-sm ${
                            category.is_active
                              ? "bg-white text-green-700"
                              : "bg-white text-gray-500"
                          }`}
                        >
                          {category.is_active ? "● Active" : "● Inactive"}
                        </span>
                      </div>

                      <div className="absolute bottom-4 right-4 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                        #{category.sort_order}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a66c72]">
                            Collection #{category.id}
                          </p>

                          <h3 className="mt-2 truncate font-serif text-xl font-normal text-[#49352f]">
                            {category.name}
                          </h3>
                        </div>

                        <div className="shrink-0 rounded-xl bg-[#f7eeeb] px-3 py-2 text-center">
                          <p className="font-serif text-xl text-[#a66c72]">
                            {category.products_count}
                          </p>
                          <p className="text-[9px] uppercase tracking-wider text-gray-400">
                            Products
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 min-h-[40px] text-xs leading-5 text-gray-400">
                        {category.description ||
                          "A curated collection of BigFred beauty products."}
                      </p>

                      <div className="mt-4 border-t border-[#f0eae5] pt-4">
                        <p className="truncate text-[11px] text-gray-400">
                          <span className="font-medium text-gray-500">
                            Slug:
                          </span>{" "}
                          {category.slug}
                        </p>
                      </div>

                      <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-2">
                        <button
                          onClick={() => openEditModal(category)}
                          className="rounded-lg border border-[#e9ddd7] px-3 py-2.5 text-xs font-medium text-[#49352f] transition hover:border-[#c58c91] hover:bg-[#faf4f1]"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => toggleStatus(category)}
                          disabled={actionLoading === category.id}
                          className="rounded-lg border border-[#e9ddd7] px-3 py-2.5 text-xs font-medium text-[#49352f] transition hover:border-[#c58c91] hover:bg-[#faf4f1] disabled:opacity-50"
                        >
                          {actionLoading === category.id
                            ? "Please wait..."
                            : category.is_active
                              ? "Deactivate"
                              : "Activate"}
                        </button>

                        <button
                          onClick={() => deleteCategory(category)}
                          disabled={actionLoading === category.id}
                          aria-label={`Delete ${category.name}`}
                          title="Delete category"
                          className="rounded-lg border border-red-100 px-3 py-2.5 text-sm text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-2 border-t border-[#eee5df] bg-white px-5 py-4 text-xs text-gray-400 sm:flex-row sm:items-center sm:px-7">
            <p>
              Showing {filteredCategories.length} of {categories.length} collections
            </p>
            <p>BigFred · Collection Management</p>
          </div>
        </section>

        <footer className="py-8 text-center text-[11px] tracking-wide text-gray-400">
          © {new Date().getFullYear()} BigFred. Admin Workspace.
        </footer>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#30221f]/50 p-4 backdrop-blur-sm">
          <div className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#eee5df] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eee5df] px-6 py-5 sm:px-8">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a66c72]">
                  Store organization
                </p>

                <h3 className="mt-2 font-serif text-2xl font-normal">
                  {editingCategory
                    ? "Refine Collection"
                    : "Create Collection"}
                </h3>

                <p className="mt-1 text-xs text-gray-400">
                  Set up the details for this store category.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8f0ed] text-xl text-[#49352f] transition hover:bg-[#f0e2de] disabled:opacity-50"
                aria-label="Close category form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6 sm:p-8">
              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#49352f]">
                  Category name *
                </label>

                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="e.g. Body Care"
                  className="w-full rounded-xl border border-[#eee5df] bg-[#fcfaf8] px-4 py-3.5 text-sm outline-none transition focus:border-[#c58c91]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#49352f]">
                  Description
                </label>

                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                  placeholder="Describe this collection..."
                  className="w-full resize-none rounded-xl border border-[#eee5df] bg-[#fcfaf8] px-4 py-3.5 text-sm outline-none transition focus:border-[#c58c91]"
                />
              </div>

              {/* Image uploader */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#49352f]">
                  Category image
                </label>

                <div className="overflow-hidden rounded-xl border border-dashed border-[#d9c5bc] bg-[#fcfaf8] p-4">
                  {currentImage ? (
                    <div className="relative overflow-hidden rounded-lg bg-[#f4ebe7]">
                      <Image src={currentImage} alt="Category image preview" width={400} height={192} unoptimized className="h-48 w-full object-cover" />

                      <div className="absolute right-3 top-3">
                        <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#49352f] shadow">
                          {imageFile ? "New image preview" : "Current image"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center rounded-lg bg-[#f7eeeb] text-center">
                      <span className="text-3xl text-[#b88789]">↑</span>
                      <p className="mt-2 text-sm font-medium text-[#49352f]">
                        No category image selected
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Choose an image from your computer.
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#49352f] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#35251f]">
                      {imageFile || editingCategory?.image
                        ? "Choose / Replace Image"
                        : "Choose Image"}

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                        disabled={saving}
                      />
                    </label>

                    {currentImage && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        disabled={saving}
                        className="rounded-lg border border-red-200 px-4 py-2.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-[11px] leading-5 text-gray-400">
                    JPG, PNG or WebP · Maximum file size: 5 MB.
                    The image will be uploaded when you save the category.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#49352f]">
                  Display order
                </label>

                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sort_order: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-[#eee5df] bg-[#fcfaf8] px-4 py-3.5 text-sm outline-none transition focus:border-[#c58c91]"
                />

                <p className="mt-2 text-xs text-gray-400">
                  Lower numbers appear first when categories are sorted by display order.
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#eee5df] bg-[#fcfaf8] p-4">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      is_active: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-[#a66c72]"
                />

                <span>
                  <span className="block text-sm font-medium text-[#49352f]">
                    Publish this category
                  </span>
                  <span className="mt-1 block text-xs text-gray-400">
                    Make this collection visible in your store.
                  </span>
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-[#f0eae5] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="rounded-xl border border-[#eee5df] px-6 py-3 text-sm font-medium text-[#49352f] transition hover:bg-[#fcfaf8] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#49352f] px-7 py-3 text-sm font-medium text-white transition hover:bg-[#35251f] disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingCategory
                      ? "Save Changes"
                      : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
