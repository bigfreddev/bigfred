
"use client";

import { useEffect, useMemo, useState } from "react";

type Review = {
  id: number;
  name: string;
  product: string;
  category: string;
  rating: number;
  text: string;
  verified: boolean;
};

type ApiReview = {
  id: number;
  customer_name: string;
  product_name: string;
  rating: number;
  review_text: string;
  is_verified_purchase: boolean;
};

type ReviewsResponse = {
  success: boolean;
  data?: {
    data?: ApiReview[];
  };
  message?: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api";

const categories = [
  "All Products",
  "Body Oils",
  "Body Creams",
  "Hair Oils",
];

const products = [
  "Golden Glow Body Oil",
  "Cocoa Silk Body Cream",
  "Nourish & Shine Hair Oil",
  "Rose Petal Body Oil",
  "Shea Comfort Body Cream",
  "Root Revival Hair Oil",
  "Amber Glow Body Oil",
  "Curl Softening Hair Oil",
];

function getCategory(product: string) {
  if (product.toLowerCase().includes("body cream")) {
    return "Body Creams";
  }

  if (product.toLowerCase().includes("hair oil")) {
    return "Hair Oils";
  }

  return "Body Oils";
}

function mapApiReview(review: ApiReview): Review {
  return {
    id: review.id,
    name: review.customer_name,
    product: review.product_name,
    category: getCategory(review.product_name),
    rating: review.rating,
    text: review.review_text,
    verified: review.is_verified_purchase,
  };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="bf-review-stars"
      aria-label={`${rating} out of 5 stars`}
    >
      {"★".repeat(rating)}
      <span className="bf-review-empty-stars">
        {"★".repeat(5 - rating)}
      </span>
    </span>
  );
}

export default function Testimonials() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [category, setCategory] = useState("All Products");
  const [start, setStart] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [product, setProduct] = useState(products[0]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadReviews() {
      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch(`${API_URL}/reviews`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Unable to load customer reviews.");
        }

        const result: ReviewsResponse = await response.json();

        if (!result.success) {
          throw new Error("Unable to load customer reviews.");
        }

        const apiReviews = result.data?.data ?? [];

        setReviews(apiReviews.map(mapApiReview));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setLoadError(
          "We couldn't load reviews right now. Please try refreshing the page."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadReviews();

    return () => controller.abort();
  }, []);

  const filteredReviews = useMemo(
    () =>
      category === "All Products"
        ? reviews
        : reviews.filter((review) => review.category === category),
    [reviews, category]
  );

  const average =
    filteredReviews.length > 0
      ? filteredReviews.reduce((sum, review) => sum + review.rating, 0) /
        filteredReviews.length
      : 0;

  const visibleReviews = useMemo(() => {
    if (!filteredReviews.length) return [];

    const count = Math.min(3, filteredReviews.length);

    return Array.from(
      { length: count },
      (_, index) => filteredReviews[(start + index) % filteredReviews.length]
    );
  }, [filteredReviews, start]);

  function changeCategory(nextCategory: string) {
    setCategory(nextCategory);
    setStart(0);
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    const cleanName = name.trim();
    const cleanText = reviewText.trim();

    if (!cleanName || cleanText.length < 5) {
      setMessage("Please enter your name and a review of at least 5 characters.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      // Obtain a fresh Laravel Sanctum CSRF cookie before submitting.
      const csrfResponse = await fetch(
        "http://localhost:8001/sanctum/csrf-cookie",
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!csrfResponse.ok) {
        throw new Error(
          "Unable to establish a secure connection. Please try again."
        );
      }

      // Read the XSRF-TOKEN cookie and send it in the expected header.
      const xsrfCookie = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("XSRF-TOKEN="));

      if (!xsrfCookie) {
        throw new Error(
          "Security token not found. Please refresh the page and try again."
        );
      }

      const xsrfToken = decodeURIComponent(
        xsrfCookie.substring("XSRF-TOKEN=".length)
      );

      const response = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-XSRF-TOKEN": xsrfToken,
        },
        body: JSON.stringify({
          customer_name: cleanName,
          product_name: product,
          rating,
          review_text: cleanText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const validationMessage = result.errors
          ? Object.values(result.errors).flat().join(" ")
          : result.message;

        throw new Error(
          validationMessage || "Your review could not be submitted."
        );
      }

      setName("");
      setProduct(products[0]);
      setReviewText("");
      setRating(5);
      setShowForm(false);
      setMessage(
        result.message ||
          "Thank you! Your review has been submitted for approval."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bf-testimonials" id="customer-reviews">
      <div className="bf-testimonials-inner">
        <div className="bf-testimonials-heading">
          <span className="bf-eyebrow">THE DHYSEM EXPERIENCE</span>
          <h2>A little love from our customers</h2>
          <p>
            Discover customer experiences and share a little love of your own.
          </p>
        </div>

        {loadError && (
          <p className="bf-review-message" role="alert">
            {loadError}
          </p>
        )}

        <div className="bf-review-summary">
          <div className="bf-average">
            <strong>
              {loading || !filteredReviews.length
                ? "—"
                : average.toFixed(1)}
            </strong>
            <Stars rating={Math.round(average)} />
            <span>
              {loading
                ? "Loading reviews..."
                : `${filteredReviews.length} ${
                    filteredReviews.length === 1 ? "review" : "reviews"
                  }`}
            </span>
          </div>

          <div className="bf-review-filters" aria-label="Filter reviews">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "active" : ""}
                onClick={() => changeCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="bf-no-reviews" role="status">
            <p>Loading customer reviews...</p>
          </div>
        ) : visibleReviews.length > 0 ? (
          <div className="bf-review-grid">
            {visibleReviews.map((review) => (
              <article className="bf-review-card" key={review.id}>
                <div className="bf-review-card-top">
                  <Stars rating={review.rating} />
                  <span className="bf-review-quote">“</span>
                </div>

                <p className="bf-review-text">{review.text}</p>

                <div className="bf-reviewed-product">
                  <span>PRODUCT</span>
                  <strong>{review.product}</strong>
                </div>

                <div className="bf-review-author">
                  <div className="bf-review-avatar">
                    {review.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="bf-review-author-info">
                    <strong>{review.name}</strong>
                    {review.verified ? (
                      <span className="bf-verified">
                        ✓ Verified purchase
                      </span>
                    ) : (
                      <span className="bf-unverified">
                        Customer review
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="bf-no-reviews">
            <p>
              {category === "All Products"
                ? "No approved customer reviews yet. Be the first to share your experience!"
                : "No reviews for this category yet."}
            </p>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setShowForm(true);
              }}
            >
              Be the first to review
            </button>
          </div>
        )}

        {filteredReviews.length > 3 && !loading && (
          <div className="bf-carousel-controls">
            <button
              type="button"
              aria-label="Previous reviews"
              onClick={() =>
                setStart(
                  (start - 1 + filteredReviews.length) %
                    filteredReviews.length
                )
              }
            >
              ←
            </button>

            <span>
              Showing {Math.min(3, filteredReviews.length)} of{" "}
              {filteredReviews.length}
            </span>

            <button
              type="button"
              aria-label="Next reviews"
              onClick={() =>
                setStart((start + 1) % filteredReviews.length)
              }
            >
              →
            </button>
          </div>
        )}

        <div className="bf-review-cta">
          <div>
            <h3>Have a Dhysem favourite?</h3>
            <p>Share your experience with our community.</p>
          </div>

          <button
            type="button"
            className="bf-write-review"
            onClick={() => {
              setMessage("");
              setShowForm((current) => !current);
            }}
          >
            {showForm ? "Close form" : "Write a review"} <span>↗</span>
          </button>
        </div>

        {message && (
          <p className="bf-review-message" role="status">
            {message}
          </p>
        )}

        {showForm && (
          <form className="bf-review-form" onSubmit={submitReview}>
            <h3>Share your experience</h3>

            <label htmlFor="bf-review-name">Your name</label>
            <input
              id="bf-review-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              maxLength={80}
              required
            />

            <label htmlFor="bf-review-product">Product reviewed</label>
            <select
              id="bf-review-product"
              value={product}
              onChange={(event) => setProduct(event.target.value)}
            >
              {products.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label>Your rating</label>
            <div className="bf-rating-picker" aria-label="Choose a rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} stars`}
                  aria-pressed={rating === value}
                  className={value <= rating ? "selected" : ""}
                  onClick={() => setRating(value)}
                >
                  ★
                </button>
              ))}
            </div>

            <label htmlFor="bf-review-text">Your review</label>
            <textarea
              id="bf-review-text"
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Tell us about your experience..."
              rows={4}
              minLength={5}
              maxLength={1000}
              required
            />

            <button
              type="submit"
              className="bf-submit-review"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit review"}
            </button>

            <p className="bf-form-note">
              Your review will be saved and displayed after approval.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
