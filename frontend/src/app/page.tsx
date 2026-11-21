

"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import Testimonials from "./Testimonials";

import api from "@/lib/api";

import "./Bigfred.css";

type Product = {

  id: number;

  slug: string;

  category: string;

  categoryId: number;

  name: string;

  detail: string;

  price: number;

  oldPrice: number | null;

  rating: number;

  reviews: number;

  badge: string;

  image: string;

  swatches: string[];

};

type CartItem = { id: number; qty: number };

type ApiProduct = {

  id: number;

  slug: string;

  category_id: number;

  name: string;

  short_description: string | null;

  description: string | null;

  price: string | number;

  compare_at_price: string | number | null;

  is_featured: boolean;

  category?: {

    id: number;

    name: string;

  };

  images?: {

    image_path: string;

    is_primary: boolean;

    sort_order: number;

  }[];

};

type ApiCategory = {

  id: number;

  name: string;

  is_active: boolean;

};

const API_ORIGIN = (

  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api"

).replace(/\/api\/?$/, "");

const money = (amount: number) =>

  `GH₵${amount.toLocaleString("en-GH", {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  })}`;

export default function Home() {

  const [products, setProducts] = useState<Product[]>([]);

  const [categoryNames, setCategoryNames] = useState<string[]>([]);

  const [productsLoading, setProductsLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [filter, setFilter] = useState("All");

  const [search, setSearch] = useState("");

  const [sort, setSort] = useState("featured");

  const [cart, setCart] = useState<CartItem[]>([]);

  const [cartReady, setCartReady] = useState(false);

  // Restore the shopping cart when the page loads.

  useEffect(() => {

    try {

      const savedCart = localStorage.getItem("bigfred_cart");

      if (savedCart) {

        const parsedCart = JSON.parse(savedCart);

        if (Array.isArray(parsedCart)) {

          const validCart = parsedCart.filter(

            (item): item is CartItem =>

              Number.isInteger(item.id) &&

              Number.isInteger(item.qty) &&

              item.id > 0 &&

              item.qty > 0

          );

          setCart(validCart);

        }

      }

    } catch (error) {

      console.error("Unable to restore shopping cart:", error);

    } finally {

      setCartReady(true);

    }

  }, []);

  // Save cart changes automatically.

  useEffect(() => {

    if (!cartReady) return;

    try {

      localStorage.setItem("bigfred_cart", JSON.stringify(cart));

    } catch (error) {

      console.error("Unable to save shopping cart:", error);

    }

  }, [cart, cartReady]);

  const [liked, setLiked] = useState<number[]>([]);

  const [cartOpen, setCartOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const [toast, setToast] = useState("");

  const [email, setEmail] = useState("");

  const [newsletterMessage, setNewsletterMessage] = useState(

    "By subscribing, you agree to receive our occasional care notes."

  );

  // Checkout and customer authentication state

  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [checkoutError, setCheckoutError] = useState("");

  const [signInPrompt, setSignInPrompt] = useState(false);

  const [checkingCustomer, setCheckingCustomer] = useState(false);

  // Immediate lock against rapid repeated order submissions.

  const orderSubmissionInProgress = useRef(false);

  const [customerName, setCustomerName] = useState("");

  const [customerPhone, setCustomerPhone] = useState("");

  const [customerEmail, setCustomerEmail] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [deliveryLocation, setDeliveryLocation] = useState("");

  const [customerNotes, setCustomerNotes] = useState("");

  const categories = ["All", ...categoryNames];

  useEffect(() => {

    let isMounted = true;

    async function loadStoreData() {

      try {

        setProductsLoading(true);

        setLoadError("");

        const [productsResponse, categoriesResponse] = await Promise.all([

          api.get("/products"),

          api.get("/categories"),

        ]);

        if (!isMounted) return;

        const rawProducts: ApiProduct[] =

          productsResponse.data?.data?.data ?? [];

        const rawCategories: ApiCategory[] =

          categoriesResponse.data?.data ?? [];

        const allowedCategories = [

          "Body Oils",

          "Body Creams",

          "Hair Oils",

        ];

        setCategoryNames(

          rawCategories

            .filter(

              (category) =>

                category.is_active &&

                allowedCategories.includes(category.name)

            )

            .sort((a, b) => a.id - b.id)

            .map((category) => category.name)

        );

        const formattedProducts: Product[] = rawProducts.map((product) => {

          const sortedImages = [...(product.images ?? [])].sort(

            (a, b) => {

              if (a.is_primary !== b.is_primary) {

                return a.is_primary ? -1 : 1;

              }

              return a.sort_order - b.sort_order;

            }

          );

          const imagePath = sortedImages[0]?.image_path;

          const imageUrl = imagePath

            ? /^https?:\/\//i.test(imagePath)

              ? imagePath

              : `${API_ORIGIN}/storage/${imagePath.replace(/^\/+/, "")}`

            : "";

          return {

            id: product.id,

            slug: product.slug,

            categoryId: product.category_id,

            category: product.category?.name ?? "Uncategorised",

            name: product.name,

            detail:

              product.short_description ||

              product.description ||

              product.category?.name ||

              "",

            price: Number(product.price),

            oldPrice:

              product.compare_at_price !== null

                ? Number(product.compare_at_price)

                : null,

            rating: 0,

            reviews: 0,

            badge: product.is_featured ? "Featured" : "",

            image: imageUrl,

            swatches: [],

          };

        });

        setProducts(formattedProducts);

      } catch (error) {

        console.error("Failed to load BigFred store data:", error);

        if (isMounted) {

          setLoadError(

            "We couldn't load our products. Please refresh the page."

          );

        }

      } finally {

        if (isMounted) {

          setProductsLoading(false);

        }

      }

    }

    loadStoreData();

    return () => {

      isMounted = false;

    };

  }, []);

  function notify(message: string) {

    setToast(message);

    window.setTimeout(() => setToast(""), 2400);

  }

  const visibleProducts = useMemo(() => {

    const result = products.filter(

      (p) =>

        (filter === "All" || p.category === filter) &&

        `${p.name} ${p.category} ${p.detail}`

          .toLowerCase()

          .includes(search.toLowerCase())

    );

    if (sort === "price-low") result.sort((a, b) => a.price - b.price);

    if (sort === "price-high") result.sort((a, b) => b.price - a.price);

    if (sort === "rating") result.sort((a, b) => b.rating - a.rating);

    return result;

  }, [products, filter, search, sort]);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const subtotal = cart.reduce((sum, item) => {

    const product = products.find((p) => p.id === item.id);

    return sum + (product?.price ?? 0) * item.qty;

  }, 0);

  function addToCart(id: number) {

    setCart((current) => {

      const existing = current.find((item) => item.id === id);

      return existing

        ? current.map((item) =>

            item.id === id ? { ...item, qty: item.qty + 1 } : item

          )

        : [...current, { id, qty: 1 }];

    });

    const product = products.find((p) => p.id === id);

    notify(`${product?.name} added to your bag`);

  }

  function changeQuantity(id: number, delta: number) {

    setCart((current) =>

      current

        .map((item) =>

          item.id === id ? { ...item, qty: item.qty + delta } : item

        )

        .filter((item) => item.qty > 0)

    );

  }

  function chooseFilter(value: string) {

    setFilter(value);

    setMenuOpen(false);

  }

  function resetFilters() {

    setFilter("All");

    setSearch("");

    setSort("featured");

  }

  // Check customer authentication before showing checkout.

  async function openCheckout() {

    if (cart.length === 0) {

      notify("Your shopping bag is empty.");

      return;

    }

    try {

      setCheckingCustomer(true);

      setCheckoutError("");

      const response = await api.get("/customer/me");

      const customer = response.data?.customer;

      if (!customer) {

        throw new Error("Unable to retrieve your customer profile.");

      }

      setCustomerName(customer.name || "");

      setCustomerEmail(customer.email || "");

      setSignInPrompt(false);

      setCheckoutOpen(true);

    } catch (error: unknown) {

      const apiError = error as {

        response?: {

          status?: number;

        };

      };

      if (apiError.response?.status === 401) {

        setCheckoutOpen(true);

        setSignInPrompt(true);

      } else {

        setCheckoutError(

          "We couldn't retrieve your account details. Please try again."

        );

        setCheckoutOpen(false);

      }

    } finally {

      setCheckingCustomer(false);

    }

  }

  // Submit order, prepare WhatsApp message and redirect to confirmation.

  async function handleCheckoutSubmit(

    event: FormEvent<HTMLFormElement>

  ) {

    event.preventDefault();

    // Prevent multiple submissions before React has time to re-render.

    if (orderSubmissionInProgress.current || checkoutLoading) {

      return;

    }

    if (cart.length === 0) {

      setCheckoutError("Your shopping bag is empty.");

      return;

    }

    // Lock immediately before making any network requests.

    orderSubmissionInProgress.current = true;

    let whatsappWindow: Window | null = null;

    try {

      setCheckoutLoading(true);

      setCheckoutError("");

      // Verify the customer session again before creating the order.

      await api.get("/customer/me");

      // Open a blank tab immediately to reduce popup-blocking issues.

      whatsappWindow = window.open("about:blank", "_blank");

      if (whatsappWindow) {

        whatsappWindow.opener = null;

      }

      // Retrieve the WhatsApp number saved in Admin Settings.

      const settingsResponse = await api.get("/settings/whatsapp");

      const whatsappNumber = String(

        settingsResponse.data?.data?.whatsapp_number || ""

      ).replace(/\D/g, "");

      if (!whatsappNumber) {

        throw new Error(

          "WhatsApp Business number is not configured. Please update it in Admin Settings."

        );

      }

      // Create the order through Laravel.

      const orderResponse = await api.post("/orders", {

        customer_name: customerName.trim(),

        customer_phone: customerPhone.trim(),

        customer_email: customerEmail.trim() || null,

        delivery_address: deliveryAddress.trim(),

        delivery_location: deliveryLocation.trim() || null,

        customer_notes: customerNotes.trim() || null,

        items: cart.map((item) => ({

          product_id: item.id,

          quantity: item.qty,

        })),

      });

      const order = orderResponse.data?.order;

      if (!order || !order.id || !order.order_number) {

        throw new Error(

          "The order was submitted, but the order details were not returned."

        );

      }

      // Prepare the WhatsApp order message using the saved order.

      const orderItems = (order.items || [])

        .map(

          (item: {

            product_name: string;

            quantity: number;

            unit_price: number | string;

            line_total: number | string;

          }) =>

            `${item.product_name}\nQuantity: ${item.quantity}\nUnit price: ${money(Number(item.unit_price))}\nLine total: ${money(Number(item.line_total))}`

        )

        .join("\n\n");

      const message = [

        "Hello BigFred! I have just placed an order.",

        "",

        `Order Number: ${order.order_number}`,

        "",

        "ORDER DETAILS",

        orderItems,

        "",

        `Subtotal: ${money(Number(order.subtotal))}`,

        `Total: ${money(Number(order.total))}`,

        "",

        "CUSTOMER DETAILS",

        `Name: ${customerName.trim()}`,

        `Phone: ${customerPhone.trim()}`,

        `Delivery Address: ${deliveryAddress.trim()}`,

        deliveryLocation.trim()

          ? `Delivery Location: ${deliveryLocation.trim()}`

          : "",

        customerEmail.trim()

          ? `Email: ${customerEmail.trim()}`

          : "",

        customerNotes.trim()

          ? `Additional Notes: ${customerNotes.trim()}`

          : "",

        "",

        "Please confirm my order. Thank you!",

      ]

        .filter(Boolean)

        .join("\n");

      const whatsappUrl =

        `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

      // If the browser blocks the new tab, save the WhatsApp link

      // so the customer can open it from the confirmation page.

      if (whatsappWindow && !whatsappWindow.closed) {

        whatsappWindow.location.href = whatsappUrl;

      } else {

        sessionStorage.setItem(

          "bigfred_pending_whatsapp_url",

          whatsappUrl

        );

      }

      // Clear the cart only after Laravel successfully creates the order.

      setCart([]);

      setCartOpen(false);

      setCheckoutOpen(false);

      setSignInPrompt(false);

      setCustomerName("");

      setCustomerPhone("");

      setCustomerEmail("");

      setDeliveryAddress("");

      setDeliveryLocation("");

      setCustomerNotes("");

      // Redirect the current tab to the order confirmation page.

      window.location.assign(

        `/order-confirmation/${encodeURIComponent(String(order.id))}`

      );

    } catch (error: unknown) {

      if (whatsappWindow && !whatsappWindow.closed) {

        whatsappWindow.close();

      }

      const apiError = error as {

        response?: {

          status?: number;

          data?: {

            message?: string;

            errors?: Record<string, string[]>;

          };

        };

      };

      if (apiError.response?.status === 401) {

        setSignInPrompt(true);

        setCheckoutError("");

        return;

      }

      const validationErrors = apiError.response?.data?.errors;

      const firstValidationError = validationErrors

        ? Object.values(validationErrors).flat()[0]

        : undefined;

      setCheckoutError(

        firstValidationError ||

          apiError.response?.data?.message ||

          (error instanceof Error

            ? error.message

            : "Unable to place your order. Please try again.")

      );

    } finally {

      setCheckoutLoading(false);

      // Release the lock if the order request failed.

      // On success, the page redirects to the confirmation screen.

      orderSubmissionInProgress.current = false;

    }

  }

  return (

    <>

      <div className="announcement">

        A little luxury, delivered to your door <span>✦</span> Free delivery on

        orders over GH₵500

      </div>

      <header className="site-header">

        <button

          className="icon-btn menu-toggle"

          onClick={() => setMenuOpen(!menuOpen)}

          aria-label="Toggle navigation"

        >

          ☰

        </button>

        <a className="brand" href="#top" aria-label="BigFred home">

          bigfred<span>.</span>

        </a>

        <nav className={`main-nav ${menuOpen ? "open" : ""}`}>

          {categories.map((category) => (

            <a

              key={category}

              href="#shop"

              className={filter === category ? "active" : ""}

              onClick={() => chooseFilter(category)}

            >

              {category === "All" ? "Shop all" : category}

            </a>

          ))}

          <a href="#story" onClick={() => setMenuOpen(false)}>

            Our story

          </a>

        </nav>

        <div className="header-actions">

          <button

            className="icon-btn"

            aria-label="Search products"

            onClick={() => setSearchOpen(!searchOpen)}

          >

            ⌕

          </button>

          <a

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

          </a>

          <button

            className="icon-btn bag-btn"

            aria-label="Open shopping bag"

            onClick={() => setCartOpen(true)}

          >

            ♧ <span className="cart-count">{cartCount}</span>

          </button>

        </div>

      </header>

      <div className={`search-panel ${searchOpen ? "open" : ""}`}>

        <label htmlFor="searchInput">Find your next favourite</label>

        <div className="search-field">

          <span>⌕</span>

          <input

            id="searchInput"

            type="search"

            placeholder="Search body oils, creams, hair oils..."

            value={search}

            onChange={(event) => setSearch(event.target.value)}

          />

          <button

            aria-label="Clear search"

            onClick={() => setSearch("")}

          >

            ×

          </button>

        </div>

      </div>

      <main id="top">

        <section className="hero">

          <div className="hero-copy">

            <p className="eyebrow">

              <span className="eyebrow-line" /> YOUR EVERYDAY RITUAL

            </p>

            <h1>

              Care that feels

              <br />

              like <em>you.</em>

            </h1>

            <p className="hero-description">

              Nourish your skin. Love your roots. Discover body oils, rich

              creams and hair oils made for your everyday care ritual.

            </p>

            <div className="hero-buttons">

              <a className="button button-dark" href="#shop">

                Explore our products <span>↗</span>

              </a>

              <a className="text-link" href="#story">

                Discover our story <span>→</span>

              </a>

            </div>

            <div className="hero-proof">

              <div className="avatar-stack">

                <span>✿</span>

                <span>✦</span>

                <span>♡</span>

              </div>

              <div>

                <strong>Made for your ritual</strong>

                <p>Body care and hair care, thoughtfully chosen</p>

              </div>

            </div>

          </div>

          <div className="hero-art">

            <div

              className="hero-image"

              role="img"

              aria-label="Body care oils and creams"

            />

            <div className="floating-note">

              <span className="note-star">✳</span>

              <div>

                <strong>Your glow, your rules.</strong>

                <small>Skin-loving and hair-loving essentials.</small>

              </div>

            </div>

            <div className="hero-stamp">

              <span>MADE FOR</span>

              <strong>YOUR<br />RITUAL</strong>

              <span>✦ EVERY DAY ✦</span>

            </div>

          </div>

          <div className="hero-bottom-note">SKIN FIRST. ROOTS ALWAYS.</div>

        </section>

        <section className="trust-strip" aria-label="Our promises">

          <div><span>✧</span> Curated with care</div>

          <div><span>♡</span> Everyday nourishment</div>

          <div><span>♧</span> Skin &amp; hair essentials</div>

          <div><span>✦</span> Easy, thoughtful shopping</div>

        </section>

        <section className="category-section" id="categories">

          <div className="section-wrap category-section-inner">

            <div className="section-heading category-heading">

              <div>

                <p className="eyebrow">SHOP YOUR WAY</p>

                <h2>Choose your <em>ritual.</em></h2>

                <p className="section-subtitle">

                  Explore a collection made for your skin and hair.

                </p>

              </div>

              <span className="category-side-note">

                THOUGHTFUL CARE, EVERY DAY ✳

              </span>

            </div>

            <div className="category-cards">

              {[

                { name: "All", title: "Shop everything", desc: "All our essentials", image: "category-all" },

                { name: "Body Oils", title: "Body oils", desc: "Glow from head to toe", image: "category-oil" },

                { name: "Body Creams", title: "Body creams", desc: "Rich, lasting moisture", image: "category-cream" },

                { name: "Hair Oils", title: "Hair oils", desc: "Care for your crown", image: "category-hair" },

              ].map((category) => (

                <button

                  key={category.name}

                  className={`category-card ${filter === category.name ? "active" : ""}`}

                  onClick={() => chooseFilter(category.name)}

                >

                  <span className={`category-image ${category.image}`} />

                  <span className="category-card-copy">

                    <strong>{category.title}</strong>

                    <small>{category.desc} <b>↗</b></small>

                  </span>

                </button>

              ))}

            </div>

          </div>

        </section>

        <section className="shop-section section-wrap" id="shop">

          <div className="section-heading product-section-heading">

            <div>

              <p className="eyebrow">THE CARE COLLECTION</p>

              <h2>Everyday <em>favourites.</em></h2>

              <p className="section-subtitle">

                Good-for-you essentials, ready to find their place in your routine.

              </p>

            </div>

            <span className="product-count-note">YOUR NEXT HOLY GRAIL AWAITS</span>

          </div>

          <div className="shop-toolbar">

            <div className="filter-list">

              {categories.map((category) => (

                <button

                  key={category}

                  className={`filter-chip ${filter === category ? "selected" : ""}`}

                  onClick={() => chooseFilter(category)}

                >

                  {category === "All" ? "All products" : category}

                  {category === "All" && <span>{String(products.length).padStart(2, "0")}</span>}

                </button>

              ))}

            </div>

            <label className="sort-control">

              Sort by

              <select value={sort} onChange={(event) => setSort(event.target.value)}>

                <option value="featured">Featured</option>

                <option value="price-low">Price: low to high</option>

                <option value="price-high">Price: high to low</option>

                <option value="rating">Top rated</option>

              </select>

            </label>

          </div>

          <div className="product-grid">

            {visibleProducts.map((product) => (

              <article className="product-card" key={product.id}>

                <div className="product-visual">

                  <img src={product.image} alt={product.name} loading="lazy" />

                  {product.badge && (

                    <span className="product-badge">{product.badge}</span>

                  )}

                  <button

                    className={`wishlist ${liked.includes(product.id) ? "liked" : ""}`}

                    aria-label="Toggle wishlist"

                    onClick={() => {

                      const alreadyLiked = liked.includes(product.id);

                      setLiked((current) =>

                        alreadyLiked

                          ? current.filter((id) => id !== product.id)

                          : [...current, product.id]

                      );

                      notify(alreadyLiked ? "Removed from your wishlist" : "Saved to your wishlist");

                    }}

                  >

                    {liked.includes(product.id) ? "♥" : "♡"}

                  </button>

                  <button className="quick-add" onClick={() => addToCart(product.id)}>

                    Add to bag <span>＋</span>

                  </button>

                </div>

                <div className="product-info">

                  <div className="product-category">{product.category}</div>

                  <div className="product-name-row">

                    <h3 className="product-name">{product.name}</h3>

                    {product.rating > 0 && (

                      <div className="rating">

                        ★ {product.rating.toFixed(1)} <span>({product.reviews})</span>

                      </div>

                    )}

                  </div>

                  <p className="product-detail">{product.detail}</p>

                  <a
                    className="product-detail-link"
                    href={`/products/${encodeURIComponent(product.slug)}`}
                  >
                    View product details →
                  </a>

                  <div className="product-bottom">

                    <div className="price">

                      {money(product.price)}

                      {product.oldPrice && (

                        <span className="price-old">{money(product.oldPrice)}</span>

                      )}

                    </div>

                    <div className="swatches">

                      {product.swatches.map((colour) => (

                        <i key={colour} style={{ background: colour }} />

                      ))}

                    </div>

                  </div>

                </div>

              </article>

            ))}

          </div>

          {visibleProducts.length === 0 && (

            <div className="empty-state">

              <span>⌕</span>

              <h3>No matches just yet</h3>

              <p>Try another search or browse all our care essentials.</p>

              <button className="button button-dark" onClick={resetFilters}>

                Show all products

              </button>

            </div>

          )}

          <div className="center-action">

            <button

              className="button button-outline"

              onClick={() => {

                resetFilters();

                document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });

              }}

            >

              Explore all essentials <span>↗</span>

            </button>

          </div>

        </section>

        <section className="ritual-section" id="story">

          <div className="ritual-image" />

          <div className="ritual-copy">

            <p className="eyebrow">A SOFTER KIND OF BEAUTY</p>

            <h2>Your routine.<br />Your <em>little ritual.</em></h2>

            <p>

              Self-care doesn't need to be complicated. We bring together body

              oils, body creams and hair oils to make everyday care feel like a

              moment just for you.

            </p>

            <a className="button button-light" href="#shop">

              Find your ritual <span>↗</span>

            </a>

            <div className="ritual-signature">

              A little more you, every day. <span>♡</span>

            </div>

          </div>

        </section>

        <Testimonials />

        <section className="newsletter section-wrap">

          <div className="newsletter-icon">✳</div>

          <p className="eyebrow">NOTES FROM OUR WORLD</p>

          <h2>A little care in<br />your <em>inbox.</em></h2>

          <p>New arrivals, care tips and a treat for your first order.</p>

          <form

            className="newsletter-form"

            onSubmit={(event) => {

              event.preventDefault();

              setNewsletterMessage("Thanks for joining BigFred's care notes!");

              setEmail("");

            }}

          >

            <label className="sr-only" htmlFor="emailInput">Email address</label>

            <input

              id="emailInput"

              type="email"

              placeholder="Your email address"

              required

              value={email}

              onChange={(event) => setEmail(event.target.value)}

            />

            <button type="submit">Count me in <span>→</span></button>

          </form>

          <small>{newsletterMessage}</small>

        </section>

      </main>

      <footer className="site-footer">

        <a className="brand" href="#top">bigfred<span>.</span></a>

        <p>Body &amp; hair care, beautifully chosen.</p>

        <div className="footer-links">

          <a href="#shop">Shop</a>

          <a href="#story">Our story</a>

          <a href="mailto:hello@bigfred.example">Contact</a>

          <a href="#top">Back to top ↑</a>

        </div>

        <small>© 2026 BigFred. All rights reserved.</small>

      </footer>

      <div

        className={`overlay ${cartOpen ? "visible" : ""}`}

        onClick={() => setCartOpen(false)}

      />

      <aside

        className={`cart-drawer ${cartOpen ? "open" : ""}`}

        aria-label={checkoutOpen ? "Checkout" : "Shopping bag"}

        aria-hidden={!cartOpen}

      >

        <div className="drawer-header">

          <div>

            <p className="eyebrow">

              {checkoutOpen ? "COMPLETE YOUR ORDER" : "YOUR EDIT"}

            </p>

            <h2>

              {checkoutOpen

                ? signInPrompt

                  ? "Welcome to BigFred"

                  : "Checkout"

                : "Your bag"}

              {!checkoutOpen && <span> ({cartCount})</span>}

            </h2>

          </div>

          <button

            className="close-btn"

            onClick={() => {

              setCartOpen(false);

              setCheckoutOpen(false);

              setSignInPrompt(false);

              setCheckoutError("");

            }}

            aria-label="Close bag"

          >

            ×

          </button>

        </div>

        {checkoutOpen ? (

          signInPrompt ? (

            <div className="checkout-form">

              <button

                type="button"

                className="checkout-back"

                onClick={() => {

                  setCheckoutOpen(false);

                  setSignInPrompt(false);

                  setCheckoutError("");

                }}

              >

                ← Back to your bag

              </button>

              <div className="checkout-intro">

                <h3>Your care ritual awaits.</h3>

                <p>

                  Please sign in to your BigFred account before proceeding

                  to checkout. Your account helps us manage your orders

                  and delivery details.

                </p>

              </div>

              <div className="checkout-summary">

                <h3>Your shopping bag</h3>

                {cart.map((item) => {

                  const product = products.find((p) => p.id === item.id);

                  if (!product) return null;

                  return (

                    <div className="checkout-summary-line" key={item.id}>

                      <span>

                        {product.name} × {item.qty}

                      </span>

                      <strong>

                        {money(product.price * item.qty)}

                      </strong>

                    </div>

                  );

                })}

                <div className="checkout-summary-total">

                  <span>Subtotal</span>

                  <strong>{money(subtotal)}</strong>

                </div>

              </div>

              <div className="checkout-auth-actions">

                <a

                  href="/login"

                  className="button button-dark checkout-submit"

                >

                  Sign in to continue <span>→</span>

                </a>

                <a

                  href="/register"

                  className="button button-outline checkout-submit"

                >

                  Create an account

                </a>

              </div>

              <small className="checkout-secure-note">

                ♡ Your BigFred account keeps your orders and details together.

              </small>

            </div>

          ) : (

            <form

              className="checkout-form"

              onSubmit={handleCheckoutSubmit}

            >

              <button

                type="button"

                className="checkout-back"

                onClick={() => {

                  setCheckoutOpen(false);

                  setCheckoutError("");

                }}

              >

                ← Back to your bag

              </button>

              <div className="checkout-intro">

                <h3>Almost yours.</h3>

                <p>

                  Enter your delivery details below. We'll prepare your order

                  and connect you to BigFred on WhatsApp for confirmation.

                </p>

              </div>

              <div className="checkout-fields">

                <div className="checkout-field">

                  <label htmlFor="customerName">Full name</label>

                  <input

                    id="customerName"

                    type="text"

                    value={customerName}

                    readOnly

                    autoComplete="name"

                  />

                  <small>Retrieved from your BigFred account.</small>

                </div>

                <div className="checkout-field">

                  <label htmlFor="customerPhone">Phone number *</label>

                  <input

                    id="customerPhone"

                    type="tel"

                    placeholder="e.g. 024 XXX XXXX"

                    autoComplete="tel"

                    required

                    maxLength={30}

                    value={customerPhone}

                    onChange={(event) => setCustomerPhone(event.target.value)}

                  />

                </div>

                <div className="checkout-field">

                  <label htmlFor="customerEmail">Email address</label>

                  <input

                    id="customerEmail"

                    type="email"

                    value={customerEmail}

                    readOnly

                    autoComplete="email"

                  />

                  <small>Retrieved from your registered email address.</small>

                </div>

                <div className="checkout-field">

                  <label htmlFor="deliveryAddress">Delivery address *</label>

                  <textarea

                    id="deliveryAddress"

                    placeholder="Enter your house number, street and delivery address"

                    autoComplete="street-address"

                    required

                    maxLength={2000}

                    rows={3}

                    value={deliveryAddress}

                    onChange={(event) => setDeliveryAddress(event.target.value)}

                  />

                </div>

                <div className="checkout-field">

                  <label htmlFor="deliveryLocation">

                    Area / nearest landmark (optional)

                  </label>

                  <input

                    id="deliveryLocation"

                    type="text"

                    placeholder="e.g. East Legon, near the mall"

                    maxLength={255}

                    value={deliveryLocation}

                    onChange={(event) => setDeliveryLocation(event.target.value)}

                  />

                </div>

                <div className="checkout-field">

                  <label htmlFor="customerNotes">

                    Additional notes (optional)

                  </label>

                  <textarea

                    id="customerNotes"

                    placeholder="Any special delivery instructions?"

                    rows={2}

                    maxLength={2000}

                    value={customerNotes}

                    onChange={(event) => setCustomerNotes(event.target.value)}

                  />

                </div>

              </div>

              <div className="checkout-summary">

                <h3>Your order</h3>

                {cart.map((item) => {

                  const product = products.find((p) => p.id === item.id);

                  if (!product) return null;

                  return (

                    <div className="checkout-summary-line" key={item.id}>

                      <span>

                        {product.name} × {item.qty}

                      </span>

                      <strong>{money(product.price * item.qty)}</strong>

                    </div>

                  );

                })}

                <div className="checkout-summary-total">

                  <span>Estimated subtotal</span>

                  <strong>{money(subtotal)}</strong>

                </div>

                <p>

                  Final order totals are calculated by BigFred when your

                  order is submitted. Delivery arrangements will be confirmed

                  through WhatsApp.

                </p>

              </div>

              {checkoutError && (

                <div className="checkout-error" role="alert">

                  {checkoutError}

                </div>

              )}

              <button

                type="submit"

                className="button button-dark checkout-submit"

                disabled={checkoutLoading}

              >

                {checkoutLoading

                  ? "Preparing your order..."

                  : "Place order & continue to WhatsApp"}

                {!checkoutLoading && <span>→</span>}

              </button>

              <small className="checkout-secure-note">

                ♡ No online payment required. Confirm your order with us on WhatsApp.

              </small>

            </form>

          )

        ) : (

          <>

            <div className="shipping-progress">

              <p>

                {subtotal >= 500

                  ? "Lovely! You've unlocked free delivery."

                  : `You're ${money(500 - subtotal)} away from free delivery.`}

              </p>

              <div className="progress-track">

                <span

                  style={{

                    width: `${Math.min(100, (subtotal / 500) * 100)}%`,

                  }}

                />

              </div>

            </div>

            <div className="cart-items">

              {cart.map((item) => {

                const product = products.find((p) => p.id === item.id);

                if (!product) return null;

                return (

                  <div className="cart-line" key={item.id}>

                    <img src={product.image} alt={product.name} />

                    <div>

                      <h3>{product.name}</h3>

                      <p>{product.detail}</p>

                      <div className="line-price">

                        {money(product.price)}

                      </div>

                      <div className="quantity-control">

                        <button

                          onClick={() => changeQuantity(item.id, -1)}

                          aria-label="Decrease quantity"

                        >

                          −

                        </button>

                        <span>{item.qty}</span>

                        <button

                          onClick={() => changeQuantity(item.id, 1)}

                          aria-label="Increase quantity"

                        >

                          +

                        </button>

                      </div>

                    </div>

                    <button

                      className="remove-item"

                      onClick={() =>

                        setCart((current) =>

                          current.filter((x) => x.id !== item.id)

                        )

                      }

                      aria-label={`Remove ${product.name}`}

                    >

                      ×

                    </button>

                  </div>

                );

              })}

            </div>

            {cartCount === 0 ? (

              <div className="cart-empty">

                <span>♡</span>

                <h3>Your bag is taking a breather</h3>

                <p>Add something lovely to get started.</p>

                <button

                  className="button button-dark"

                  onClick={() => setCartOpen(false)}

                >

                  Keep exploring

                </button>

              </div>

            ) : (

              <div className="cart-footer">

                <div className="subtotal-row">

                  <span>Subtotal</span>

                  <strong>{money(subtotal)}</strong>

                </div>

                <p>

                  Delivery and any discounts are calculated at checkout.

                </p>

                {checkoutError && (

                  <div className="checkout-error" role="alert">

                    {checkoutError}

                  </div>

                )}

                <button

                  className="button button-dark checkout-btn"

                  onClick={openCheckout}

                  disabled={checkingCustomer}

                >

                  {checkingCustomer

                    ? "Checking your account..."

                    : "Continue to checkout"}

                  {!checkingCustomer && <span>→</span>}

                </button>

                <small>♡ Thoughtful shopping, made easy</small>

              </div>

            )}

          </>

        )}

      </aside>

      <div className={`toast ${toast ? "show" : ""}`} role="status">

        {toast}

      </div>

    </>

  );

}
