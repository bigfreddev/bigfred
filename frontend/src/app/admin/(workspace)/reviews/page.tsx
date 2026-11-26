
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import api from "@/lib/api";

type ApiErrorResponse = {
  message?: string;
};

function isAuthError(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 403)
  );
}

function getReviewErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
type Review = {
  id: number;
  customer_name: string;
  customer_email: string | null;
  product_name: string;
  rating: number;
  review_text: string;
  status: "pending" | "approved" | "rejected";
  is_verified_purchase: boolean;
  created_at: string;
};

type Pagination = {
  current_page: number;
  last_page: number;
  total: number;
};

type Statistics = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

const statusConfig = {
  pending: {
    label: "Pending review",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    icon: "◷",
  },
  approved: {
    label: "Approved",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    icon: "✓",
  },
  rejected: {
    label: "Rejected",
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
    icon: "×",
  },
};

export default function AdminReviewsPage() {
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);

  const [stats, setStats] = useState<Statistics>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [pagination, setPagination] = useState<Pagination>({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  const [status, setStatus] = useState("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadReviews = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError("");
        setNotice("");

        const [reviewsResponse, statsResponse] = await Promise.all([
          api.get("/admin/reviews", {
            params: {
              page,
              status: status || undefined,
              search: search || undefined,
            },
          }),
          api.get("/admin/reviews/statistics"),
        ]);

        setReviews(reviewsResponse.data.data.data);

        setPagination({
          current_page: reviewsResponse.data.data.current_page,
          last_page: reviewsResponse.data.data.last_page,
          total: reviewsResponse.data.data.total,
        });

        setStats(statsResponse.data.data);
      } catch (err: unknown) {
        if (isAuthError(err)) {
          router.replace("/admin/login");
          return;
        }

        setError(getReviewErrorMessage(err, "Unable to load reviews. Please try again."));
      } finally {
        setLoading(false);
      }
    },
    [status, search, router]
  );

  // Authentication is handled by the shared admin layout.
  useEffect(() => {
    // Loads reviews when the active filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReviews(1);
  }, [loadReviews]);

  const updateReviewStatus = async (
    reviewId: number,
    newStatus: "approved" | "rejected"
  ) => {
    try {
      setUpdatingId(reviewId);
      setError("");
      setNotice("");

      await api.patch(`/admin/reviews/${reviewId}/status`, {
        status: newStatus,
      });

      setNotice(
        newStatus === "approved"
          ? "Review approved successfully."
          : "Review rejected successfully."
      );

      await loadReviews(pagination.current_page);
    } catch (err: unknown) {
      if (isAuthError(err)) {
          router.replace("/admin/login");
          return;
        }

      setError(getReviewErrorMessage(err, "Unable to update this review."));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatus(nextStatus);
  };

  const formatDate = (date: string) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Date unavailable";
    }

    return parsedDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getInitials = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

  const renderStars = (rating: number) => {
    const safeRating = Math.max(0, Math.min(5, rating));

    return (
      <div
        className="flex items-center gap-0.5"
        aria-label={`${safeRating} out of 5 stars`}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={
              index < safeRating
                ? "text-[#c58c50]"
                : "text-[#e8e0da]"
            }
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const statistics = [
    {
      label: "Total reviews",
      value: stats.total,
      description: "All customer feedback",
      icon: "◎",
      iconStyle: "bg-[#f7eee8] text-[#a66c72]",
      accent: "border-l-[#b88a7a]",
    },
    {
      label: "Awaiting review",
      value: stats.pending,
      description: "Require your attention",
      icon: "◷",
      iconStyle: "bg-amber-50 text-amber-700",
      accent: "border-l-amber-400",
    },
    {
      label: "Published reviews",
      value: stats.approved,
      description: "Visible to customers",
      icon: "✓",
      iconStyle: "bg-emerald-50 text-emerald-700",
      accent: "border-l-emerald-500",
    },
    {
      label: "Rejected reviews",
      value: stats.rejected,
      description: "Not published",
      icon: "×",
      iconStyle: "bg-red-50 text-red-600",
      accent: "border-l-red-400",
    },
  ];

  const filters = [
    { label: "All reviews", value: "", count: stats.total },
    { label: "Pending", value: "pending", count: stats.pending },
    { label: "Approved", value: "approved", count: stats.approved },
    { label: "Rejected", value: "rejected", count: stats.rejected },
  ];

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[#49352f]">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">

        {/* Page heading */}
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b88a7a]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a66c72]">
                BigFred Administration
              </p>
            </div>

            <h1 className="font-serif text-3xl font-medium tracking-tight text-[#392a25] sm:text-4xl">
              Customer Reviews
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#91827b]">
              Manage customer experiences, moderate feedback and
              decide which reviews appear in your storefront.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadReviews(pagination.current_page)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e9dfd8] bg-white px-5 py-3 text-sm font-medium text-[#49352f] shadow-sm transition hover:border-[#c9aaa0] hover:bg-[#fdfbf9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-base">↻</span>
            {loading ? "Refreshing..." : "Refresh reviews"}
          </button>
        </div>

        {/* Notices */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <span className="text-lg">!</span>
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            <span className="font-semibold">✓</span>
            <p>{notice}</p>
          </div>
        )}

        {/* Statistics */}
        <div className="mb-9 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statistics.map((item) => (
            <div
              key={item.label}
              className={`group rounded-2xl border border-[#eee6e0] border-l-[3px] ${item.accent} bg-white p-5 shadow-[0_2px_12px_rgba(73,53,47,0.025)] transition hover:-translate-y-0.5 hover:shadow-md sm:p-6`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#8d7e77]">
                    {item.label}
                  </p>

                  <p className="mt-4 text-3xl font-semibold tracking-tight text-[#49352f]">
                    {item.value.toLocaleString()}
                  </p>

                  <p className="mt-2 text-xs text-[#a69a93]">
                    {item.description}
                  </p>
                </div>

                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${item.iconStyle}`}
                >
                  {item.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Moderation workspace */}
        <div className="overflow-hidden rounded-2xl border border-[#ebe3dd] bg-white shadow-[0_3px_18px_rgba(73,53,47,0.035)]">

          {/* Workspace header */}
          <div className="border-b border-[#f0eae5] px-5 py-6 sm:px-7">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-xl text-[#392a25]">
                    Review moderation
                  </h2>

                  <span className="rounded-full bg-[#f7eee8] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#a66c72]">
                    Management
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-[#9b8d85]">
                  Review submissions and manage publication status.
                </p>
              </div>

              <div className="rounded-xl bg-[#faf7f4] px-4 py-2.5">
                <p className="text-xs text-[#9b8d85]">
                  Reviews matching your filters
                </p>
                <p className="mt-0.5 text-lg font-semibold text-[#49352f]">
                  {pagination.total.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Search and filter controls */}
            <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <form
                className="flex w-full max-w-xl"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSearch();
                }}
              >
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#aa9a91]">
                    ⌕
                  </span>

                  <input
                    type="text"
                    value={searchInput}
                    onChange={(event) =>
                      setSearchInput(event.target.value)
                    }
                    placeholder="Search by customer or product..."
                    className="h-12 w-full rounded-l-xl border border-r-0 border-[#eae2dc] bg-[#fcfaf8] pl-11 pr-4 text-sm text-[#49352f] outline-none transition placeholder:text-[#b2a69f] focus:border-[#c58c91] focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  className="h-12 rounded-r-xl bg-[#49352f] px-5 text-sm font-medium text-white transition hover:bg-[#35251f]"
                >
                  Search
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium text-[#9b8d85]">
                  Filter:
                </span>

                {filters.map((filter) => (
                  <button
                    key={filter.value || "all"}
                    type="button"
                    onClick={() =>
                      handleStatusChange(filter.value)
                    }
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition ${
                      status === filter.value
                        ? "border-[#49352f] bg-[#49352f] text-white shadow-sm"
                        : "border-[#eee5df] bg-white text-[#76675f] hover:border-[#c9aaa0] hover:bg-[#fcfaf8]"
                    }`}
                  >
                    {filter.label}

                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        status === filter.value
                          ? "bg-white/15 text-white"
                          : "bg-[#f5f0ec] text-[#9b8d85]"
                      }`}
                    >
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Review list heading */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3ede8] bg-[#fcfaf8] px-5 py-4 sm:px-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#88786f]">
                Customer feedback
              </p>
              <p className="mt-1 text-xs text-[#aa9b93]">
                {status
                  ? `${status.charAt(0).toUpperCase()}${status.slice(1)} reviews`
                  : "All review submissions"}
              </p>
            </div>

            <span className="text-xs text-[#a69a93]">
              {loading ? "Updating..." : `${reviews.length} shown on this page`}
            </span>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="space-y-4 p-6 sm:p-8">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-xl border border-[#f0eae5] p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-[#f1eae4]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-36 rounded bg-[#f1eae4]" />
                      <div className="h-2.5 w-48 rounded bg-[#f6f1ed]" />
                    </div>
                    <div className="h-7 w-20 rounded-full bg-[#f1eae4]" />
                  </div>
                  <div className="mt-5 h-3 w-full rounded bg-[#f6f1ed]" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-[#f6f1ed]" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            /* Empty state */
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f8f0ed] text-3xl text-[#a66c72]">
                ☆
              </div>

              <h3 className="mt-5 font-serif text-xl text-[#49352f]">
                No reviews found
              </h3>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#9b8d85]">
                There are no reviews matching your current search
                or filter. Try adjusting your selection.
              </p>

              {(search || status !== "pending") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setStatus("");
                  }}
                  className="mt-5 rounded-xl border border-[#e9dfd8] bg-white px-5 py-2.5 text-sm font-medium text-[#49352f] transition hover:bg-[#fcfaf8]"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Review cards */}
              <div className="divide-y divide-[#f0eae5]">
                {reviews.map((review) => {
                  const currentStatus = statusConfig[review.status];
                  const isUpdating = updatingId === review.id;

                  return (
                    <article
                      key={review.id}
                      className="px-5 py-6 transition hover:bg-[#fdfbf9] sm:px-7"
                    >
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

                        {/* Review content */}
                        <div className="min-w-0 flex-1">

                          {/* Customer information */}
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#eadbd4] bg-[#f7eee8] text-sm font-semibold text-[#95676a]">
                                {getInitials(review.customer_name)}
                              </div>

                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-[#49352f]">
                                  {review.customer_name}
                                </h3>

                                <p className="mt-1 truncate text-xs text-[#a1958e]">
                                  {review.customer_email || "No email provided"}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold ${currentStatus.badge}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${currentStatus.dot}`} />
                              {currentStatus.label}
                            </span>
                          </div>

                          {/* Product and rating */}
                          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a69a93]">
                                Product
                              </span>

                              <span className="rounded-lg border border-[#eee5df] bg-[#fcfaf8] px-3 py-1.5 text-xs font-medium text-[#69564d]">
                                {review.product_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {renderStars(review.rating)}
                              <span className="text-xs font-semibold text-[#8e7c72]">
                                {review.rating}/5
                              </span>
                            </div>
                          </div>

                          {/* Review message */}
                          <div className="mt-5 rounded-xl border border-[#f0eae5] bg-[#fcfaf8] p-4 sm:p-5">
                            <div className="mb-2 flex items-center gap-2">
                              <span className="font-serif text-xl leading-none text-[#c39b8d]">
                                “
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a69a93]">
                                Customer feedback
                              </span>
                            </div>

                            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#695d56]">
                              {review.review_text}
                            </p>
                          </div>

                          {/* Review metadata */}
                          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                            <span className="flex items-center gap-1.5 text-xs text-[#a1958e]">
                              <span>▦</span>
                              {formatDate(review.created_at)}
                            </span>

                            {review.is_verified_purchase && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                                <span>✓</span>
                                Verified purchase
                              </span>
                            )}

                            <span className="text-[10px] text-[#b0a49c]">
                              Review #{review.id}
                            </span>
                          </div>
                        </div>

                        {/* Moderation actions */}
                        <div className="flex shrink-0 flex-row items-center gap-2 border-t border-[#f0eae5] pt-4 xl:w-40 xl:flex-col xl:items-stretch xl:border-0 xl:pt-0">
                          {review.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  updateReviewStatus(review.id, "approved")
                                }
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#49352f] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#35251f] disabled:cursor-not-allowed disabled:opacity-50 xl:flex-none"
                              >
                                {isUpdating ? (
                                  "Updating..."
                                ) : (
                                  <>
                                    <span>✓</span>
                                    Approve review
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  updateReviewStatus(review.id, "rejected")
                                }
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#efdedb] bg-white px-4 py-3 text-xs font-semibold text-[#a65f60] transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 xl:flex-none"
                              >
                                <span>×</span>
                                Reject
                              </button>
                            </>
                          ) : (
                            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#eee5df] bg-[#fcfaf8] px-4 py-3 text-xs font-medium text-[#9b8d85]">
                              <span>{currentStatus.icon}</span>
                              {review.status === "approved"
                                ? "Published"
                                : "Not published"}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex flex-col justify-between gap-4 border-t border-[#eee5df] bg-[#fcfaf8] px-5 py-5 sm:flex-row sm:items-center sm:px-7">
                <p className="text-xs text-[#95877f]">
                  Showing page{" "}
                  <span className="font-semibold text-[#49352f]">
                    {pagination.current_page}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#49352f]">
                    {pagination.last_page}
                  </span>
                  <span className="mx-2 text-[#d1c4bb]">·</span>
                  {pagination.total.toLocaleString()} total reviews
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pagination.current_page <= 1 || loading}
                    onClick={() =>
                      loadReviews(pagination.current_page - 1)
                    }
                    className="rounded-xl border border-[#e9dfd8] bg-white px-4 py-2.5 text-xs font-medium text-[#49352f] transition hover:border-[#c9aaa0] hover:bg-[#fdfbf9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      pagination.current_page >= pagination.last_page ||
                      loading
                    }
                    onClick={() =>
                      loadReviews(pagination.current_page + 1)
                    }
                    className="rounded-xl border border-[#e9dfd8] bg-white px-4 py-2.5 text-xs font-medium text-[#49352f] transition hover:border-[#c9aaa0] hover:bg-[#fdfbf9] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="py-8 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#b0a49c]">
            BigFred · Customer Experience Management
          </p>
        </footer>
      </div>
    </div>
  );
}
