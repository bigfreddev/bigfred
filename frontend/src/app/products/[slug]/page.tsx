"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBagShopping,
  faBars,
  faHeart,
  faMagnifyingGlass,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { API_ORIGIN } from "@/lib/api";
import "../../Bigfred.css";
import "./ProductDetails.css";
type ProductImage = {
  id?: number;
  image_path: string;
  alt_text?: string | null;
  is_primary: boolean;
  sort_order: number;
};
type Product = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  sku?: string;
  short_description: string | null;
  description: string | null;
  price: string | number;
  compare_at_price: string | number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_featured: boolean;
  category?: {
    id: number;
    name: string;
  };
  images?: ProductImage[];
};
type Review = {
  id: number;
  customer_name: string;
  rating: number;
  review_text: string;
  created_at?: string;
};type CartItem = {
  id: number;
  qty: number;
};
const money = (amount: number) =>
  `GH₵${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
function imageUrl(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${API_ORIGIN}/storage/${path.replace(/^\/+/, "")}`;
}
export default function ProductDetailsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const [cartError, setCartError] = useState("");
  useEffect(() => {
    let active = true;
    async function loadProduct() {
      try {
        setLoading(true);
        setError("");
        const [productResponse, productsResponse] = await Promise.all([
          api.get(`/products/${encodeURIComponent(slug)}`),
          api.get("/products"),
        ]);
        if (!active) return;
        const currentProduct: Product | undefined =
          productResponse.data?.data;
        if (!currentProduct) {
          setError("We couldn't find this product.");
          return;
        }
        const sortedImages = [...(currentProduct.images ?? [])].sort(
          (a, b) => {
            if (a.is_primary !== b.is_primary) {
              return a.is_primary ? -1 : 1;
            }
            return a.sort_order - b.sort_order;
          }
        );
        setProduct({
          ...currentProduct,
          images: sortedImages,
        });
        // Load approved customer reviews for this product.
        setReviewsLoading(true);

        try {
          const reviewsResponse = await api.get("/reviews", {
            params: {
              product_id: currentProduct.id,
              product_name: currentProduct.name,
            },
          });

          if (active) {
            setReviews(reviewsResponse.data?.data?.data ?? []);
          }
        } catch (reviewError) {
          console.error("Unable to load product reviews:", reviewError);

          if (active) {
            setReviews([]);
          }
        } finally {
          if (active) {
            setReviewsLoading(false);
          }
        }
        const allProducts: Product[] =
          productsResponse.data?.data?.data ?? [];
                // Prefer same-category products; otherwise recommend products
        // from other categories so the section remains useful.
        const otherProducts = allProducts.filter(
          (item) => item.id !== currentProduct.id
        );

        const sameCategoryProducts = otherProducts.filter(
          (item) => item.category_id === currentProduct.category_id
        );

        const productsToRecommend =
          sameCategoryProducts.length > 0
            ? sameCategoryProducts
            : otherProducts;

        setRelatedProducts(productsToRecommend.slice(0, 4));
      } catch (err) {
        console.error("Unable to load product:", err);
        if (active) {
          setError(
            "We couldn't load this product. Please refresh the page."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    if (slug) loadProduct();
    return () => {
      active = false;
    };
  }, [slug]);
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("bigfred_cart");
      if (savedCart) {
        const parsed: CartItem[] = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCartCount(
            parsed.reduce(
              (total, item) => total + (Number(item.qty) || 0),
              0
            )
          );
        }
      }
    } catch (err) {
      console.error("Unable to read cart:", err);
    }
  }, []);
  const images = useMemo(
    () => product?.images ?? [],
    [product]
  );
  const selectedImageUrl = imageUrl(
    images[selectedImage]?.image_path
  );
  const stock = product?.stock_quantity ?? 0;
  const lowStockThreshold = product?.low_stock_threshold ?? 5;
  const inStock = stock > 0;
  const lowStock = inStock && stock <= lowStockThreshold;
  function addToBag() {
    if (!product || !inStock || adding) return;
    setCartError("");
    try {
      const savedCart = localStorage.getItem("bigfred_cart");
      const parsed: CartItem[] = savedCart
        ? JSON.parse(savedCart)
        : [];
      const currentCart = Array.isArray(parsed) ? parsed : [];
      const existing = currentCart.find(
        (item) => item.id === product.id
      );
      const currentQuantity = existing?.qty ?? 0;
      if (currentQuantity + quantity > stock) {
        setCartError(
          `Only ${stock} unit${stock === 1 ? "" : "s"} available in stock.`
        );
        return;
      }
      const updatedCart = existing
        ? currentCart.map((item) =>
            item.id === product.id
              ? { ...item, qty: item.qty + quantity }
              : item
          )
        : [...currentCart, { id: product.id, qty: quantity }];
      localStorage.setItem(
        "bigfred_cart",
        JSON.stringify(updatedCart)
      );
      setCartCount(
        updatedCart.reduce((total, item) => total + item.qty, 0)
      );
      setAdding(true);
      setAdded(true);
      window.setTimeout(() => {
        setAdding(false);
        setAdded(false);
      }, 2200);
    } catch (err) {
      console.error("Unable to update cart:", err);
      setCartError("We couldn't update your bag. Please try again.");
    }
  }
  if (loading) {
    return (
      <main className="bf-product-state">
        <span className="bf-product-spinner" />
        <p>Preparing something beautiful...</p>
      </main>
    );
  }
  if (error || !product) {
    return (
      <main className="bf-product-state">
        <p className="eyebrow">DHYSEM BEAUTY</p>
        <h1>Product unavailable</h1>
        <p>{error || "This product could not be found."}</p>
        <Link href="/" className="button button-dark">
          Return to shop
        </Link>
      </main>
    );
  }
  return (
    <main className="bf-product-page">
      <div className="announcement">
        A little luxury, delivered to your door <span>✦</span> Free delivery on
        orders over GH₵500
      </div>

      <header className="site-header">
        <button
          type="button"
          className="icon-btn menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          <FontAwesomeIcon icon={faBars} aria-hidden="true" />
        </button>

        <Link className="brand" href="/" aria-label="Dhysem home">
          dhysem<span>.</span>
        </Link>

        <nav className={`main-nav ${menuOpen ? "open" : ""}`}>
          <Link href="/#shop" onClick={() => setMenuOpen(false)}>
            Shop all
          </Link>
          {product.category?.name && (
            <Link href="/#shop" onClick={() => setMenuOpen(false)}>
              {product.category.name}
            </Link>
          )}
          <Link href="/#story" onClick={() => setMenuOpen(false)}>
            Our story
          </Link>
        </nav>

        <div className="header-actions">
          <Link
            href="/#shop"
            className="icon-btn"
            aria-label="Search products"
            title="Search products"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
          </Link>

          <Link
            href="/account"
            className="icon-btn profile-btn"
            aria-label="My account"
            title="My account"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </svg>
          </Link>

          <Link
            href="/?cart=open"
            className="icon-btn bag-btn"
            aria-label={`Open shopping bag, ${cartCount} items`}
            title="Shopping bag"
          >
            <FontAwesomeIcon icon={faBagShopping} aria-hidden="true" />
            <span className="cart-count" aria-hidden="true">{cartCount}</span>
          </Link>
        </div>
      </header>
      <div className="bf-product-breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/#shop">Shop</Link>
        <span>/</span>
        <span>{product.category?.name ?? "Beauty"}</span>
        <span>/</span>
        <strong>{product.name}</strong>
      </div>
      <section className="bf-product-layout">
        <div className="bf-product-gallery">
          <div className="bf-product-main-image">
            {selectedImageUrl ? (
              <Image src={selectedImageUrl} alt={images[selectedImage]?.alt_text || product.name} width={1200} height={1200} priority unoptimized />
            ) : (
              <div className="bf-product-no-image">
                Product image coming soon
              </div>
            )}
            {product.is_featured && (
              <span className="bf-product-featured">
                Featured
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="bf-product-thumbnails">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={image.id ?? index}
                  className={
                    selectedImage === index ? "active" : ""
                  }
                  onClick={() => setSelectedImage(index)}
                  aria-label={`View product image ${index + 1}`}
                >
                  <Image src={imageUrl(image.image_path)} alt={image.alt_text || `${product.name} image ${index + 1}`} width={160} height={160} unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bf-product-information">
          <p className="eyebrow">
            {product.category?.name ?? "DHYSEM BEAUTY"}
          </p>
          <h1>{product.name}</h1>
          {product.sku && (
            <p className="bf-product-sku">SKU: {product.sku}</p>
          )}
          <div className="bf-product-price">
            {money(Number(product.price))}
            {product.compare_at_price !== null && (
              <span>
                {money(Number(product.compare_at_price))}
              </span>
            )}
          </div>
          {product.short_description && (
            <p className="bf-product-short-description">
              {product.short_description}
            </p>
          )}
          <div className="bf-product-stock">
            {inStock ? (
              <>
                <span className="bf-stock-dot available" />
                <strong>In stock</strong>
                {lowStock && (
                  <span className="bf-stock-warning">
                    Only {stock} left
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="bf-stock-dot unavailable" />
                <strong>Currently out of stock</strong>
              </>
            )}
          </div>
          {inStock && (
            <div className="bf-product-purchase">
              <div className="bf-product-quantity">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(stock, current + 1)
                    )
                  }
                  disabled={quantity >= stock}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="bf-product-add button button-dark"
                onClick={addToBag}
                disabled={adding}
              >
                {added
                  ? "Added to your bag ✓"
                  : adding
                    ? "Adding…"
                    : "Add to bag"}
                {!added && !adding && <span aria-hidden="true">＋</span>}
              </button>
            </div>
          )}
          {cartError && (
            <p className="bf-product-error" role="alert">
              {cartError}
            </p>
          )}
          <ul className="bf-product-trust" aria-label="Good to know">
            <li>
              <strong>Free delivery</strong>
              <span>On orders over GH₵500</span>
            </li>
            <li>
              <strong>Order on WhatsApp</strong>
              <span>We confirm every order personally</span>
            </li>
            <li>
              <strong>Curated care</strong>
              <span>Thoughtfully selected essentials</span>
            </li>
          </ul>
          {added && (
            <div className="bf-product-added" role="status">
              <strong>Lovely choice!</strong>
              <p>
                {quantity} × {product.name} added to your bag.
              </p>
              <Link href="/?cart=open">Open your bag to check out.</Link>
            </div>
          )}
          {product.description && (
            <div className="bf-product-description">
              <h2>About this product</h2>
              <p>{product.description}</p>
            </div>
          )}
          <div className="bf-product-benefits">
            <div>
              <span aria-hidden="true"><FontAwesomeIcon icon={faHeart} /></span>
              <p>Thoughtfully selected beauty essentials</p>
            </div>
            <div>
              <span aria-hidden="true"><FontAwesomeIcon icon={faStar} /></span>
              <p>Personalised customer assistance</p>
            </div>
            <div>
              <span aria-hidden="true"><FontAwesomeIcon icon={faArrowRight} /></span>
              <p>Easy ordering through WhatsApp</p>
            </div>
          </div>
        </div>
      </section>
      {inStock && (
        <div className="bf-mobile-buy-bar" aria-label="Quick add to bag">
          <div>
            <small>{product.name}</small>
            <strong>{money(Number(product.price))}</strong>
          </div>
          <button
            type="button"
            className="button button-dark"
            onClick={addToBag}
            disabled={adding || added}
          >
            {added ? "Added ✓" : adding ? "Adding…" : "Add to bag"}
          </button>
        </div>
      )}

      <section className="bf-reviews-section">
        <div className="bf-reviews-heading">
          <p className="eyebrow">CUSTOMER EXPERIENCES</p>
          <h2>What customers <em>say</em></h2>
          <p>Honest feedback from customers who have tried this product.</p>
        </div>

        {reviewsLoading ? (
          <p className="bf-reviews-message">Loading customer reviews...</p>
        ) : reviews.length > 0 ? (
          <>
            <div className="bf-reviews-summary">
              <strong>{reviews.length}</strong>
              <span>approved {reviews.length === 1 ? "review" : "reviews"}</span>
            </div>

            <div className="bf-reviews-grid">
              {reviews.map((review) => {
                const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));

                return (
                  <article className="bf-review-card" key={review.id}>
                    <div
                      className="bf-review-stars"
                      aria-label={`${rating} out of 5 stars`}
                    >
                      {"★".repeat(rating)}
                      <span>{"★".repeat(5 - rating)}</span>
                    </div>

                    <p className="bf-review-text">{review.review_text}</p>

                    <div className="bf-review-author">
                      <strong>{review.customer_name}</strong>
                      {review.created_at && (
                        <time dateTime={review.created_at}>
                          {new Date(review.created_at).toLocaleDateString("en-GH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <p className="bf-reviews-message">
            No approved reviews yet. Be the first to share your experience.
          </p>
        )}
      </section>
      {relatedProducts.length > 0 && (
        <section className="bf-related-section">
          <div className="bf-related-heading">
            <p className="eyebrow">COMPLETE YOUR ROUTINE</p>
            <h2>You may also <em>love</em></h2>
            <p>Discover more from this collection.</p>
          </div>
          <div className="bf-related-grid">
            {relatedProducts.map((item) => {
              const relatedImages = [...(item.images ?? [])].sort(
                (a, b) => {
                  if (a.is_primary !== b.is_primary) {
                    return a.is_primary ? -1 : 1;
                  }
                  return a.sort_order - b.sort_order;
                }
              );
              return (
                <Link
                  href={`/products/${encodeURIComponent(item.slug)}`}
                  className="bf-related-card"
                  key={item.id}
                >
                  <div className="bf-related-image">
                    {relatedImages[0]?.image_path ? (
                      <Image src={imageUrl(relatedImages[0].image_path)} alt={item.name} width={600} height={600} unoptimized />
                    ) : (
                      <span>Image coming soon</span>
                    )}
                  </div>
                  <p>{item.category?.name ?? "Dhysem Beauty"}</p>
                  <h3>{item.name}</h3>
                  <strong>{money(Number(item.price))}</strong>
                  <span className="bf-related-link">
                    Discover product →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      <footer className="site-footer">
        <Link className="brand" href="/#top">
          dhysem<span>.</span>
        </Link>
        <p>Body &amp; hair care, beautifully chosen.</p>
        <div className="footer-links">
          <Link href="/#shop">Shop</Link>
          <Link href="/#story">Our story</Link>
          <a href="mailto:hello@bigfred.example">Contact</a>
          <Link href="/#top">Back to top ↑</Link>
        </div>
        <small>© 2026 Dhysem. All rights reserved.</small>
      </footer>
    </main>
  );
}
