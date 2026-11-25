

"use client";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBagShopping,
  faBars,
  faMagnifyingGlass,
  faChevronDown,
  faChevronUp,
  faArrowRight,
  faArrowLeft,
  faArrowUp,
  faHeart,
  faStar,
  faPlus,
  faMinus,
  faXmark,
  faLeaf,
  faCheck,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

import {
  faFacebookF,
  faInstagram,
  faTiktok,
} from "@fortawesome/free-brands-svg-icons";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import Testimonials from "./Testimonials";

import api from "@/lib/api";

import "./Bigfred.css";

type Product = {

  id: number;

  slug: string;

  category: string;

  categoryId: number;
  isFeatured: boolean;

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
  approved_reviews_count?: number;
  approved_reviews_avg_rating?: string | number | null;

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

type CustomerIdentity = {

  id?: number;

  name?: string;

  email?: string;

};

const API_ORIGIN = (

  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api"

).replace(/\/api\/?$/, "");

const money = (amount: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
export default function Home() {

  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);

  const [categoryNames, setCategoryNames] = useState<string[]>([]);
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

          // Restore validated cart data from localStorage.

          // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const [signedInCustomer, setSignedInCustomer] =
    useState<CustomerIdentity | null>(null);

  const [toast, setToast] = useState("");

  // Resolve the current customer session so the navigation can greet
  // returning customers by their real account name.
  useEffect(() => {
    let isMounted = true;

    async function loadSignedInCustomer() {
      try {
        const response = await api.get("/customer/me");
        const customer = response.data?.customer;

        if (isMounted && customer) {
          setSignedInCustomer({
            id: customer.id,
            name: customer.name || "",
            email: customer.email || "",
          });
        }
      } catch {
        // A signed-out visitor is expected to receive an auth error here.
        if (isMounted) setSignedInCustomer(null);
      }
    }

    loadSignedInCustomer();

    return () => {
      isMounted = false;
    };
  }, []);

  // Close the account menu when the customer clicks elsewhere or presses Escape.
  useEffect(() => {
    if (!accountMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

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

            : "/images/dhysem-hero.jpg";

          return {

            id: product.id,

            slug: product.slug,

            categoryId: product.category_id,
            isFeatured: product.is_featured,

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

            rating: Number(product.approved_reviews_avg_rating ?? 0),
            reviews: Number(product.approved_reviews_count ?? 0),
            badge: product.is_featured ? "Featured" : "",

            image: imageUrl,

            swatches: [],

          };

        });

        setProducts(formattedProducts);

      } catch (error) {

        console.error("Failed to load Dhysem store data:", error);

      } finally {

        if (isMounted) {



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

    if (sort === "featured") result.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
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

  function chooseCategoryCard(value: string) {

    chooseFilter(value);

    document.getElementById("shop")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });

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

        "Hello Dhysem! I have just placed an order.",

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

      router.push(`/order-confirmation/${encodeURIComponent(String(order.id))}`);

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

        A little luxury, delivered to your door <span><FontAwesomeIcon icon={faStar} aria-hidden="true" /></span> Free delivery on

        orders over {"GH\u20B5500"}
      </div>

      <header className="site-header">

        <button

          className="icon-btn menu-toggle"

          onClick={() => setMenuOpen(!menuOpen)}

          aria-label="Toggle navigation"

        >

          <FontAwesomeIcon icon={faBars} aria-hidden="true" />

        </button>

        <a className="brand" href="#top" aria-label="Dhysem home">

          dhysem<span>.</span>

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

            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />

          </button>

          {signedInCustomer ? (
            <div className="account-menu" ref={accountMenuRef}>
              <button
                type="button"
                className="account-greeting"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-controls="customer-account-menu"
                aria-label={`Open account menu for ${signedInCustomer.name || "customer"}`}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="account-greeting-prefix">Hi,</span>{" "}
                <strong>
                  {(signedInCustomer.name || "there").trim().split(/\s+/)[0]}
                </strong>
                <span className="account-greeting-chevron" aria-hidden="true">
                  {accountMenuOpen ? <FontAwesomeIcon icon={faChevronUp} aria-hidden="true" /> : <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />}
                </span>
              </button>

              {accountMenuOpen && (
                <div
                  className="account-dropdown"
                  id="customer-account-menu"
                  role="menu"
                >
                  <div className="account-dropdown-heading">
                    <span className="account-dropdown-kicker">SIGNED IN AS</span>
                    <strong>{signedInCustomer.name || "Dhysem customer"}</strong>
                    {signedInCustomer.email && (
                      <span className="account-dropdown-email">
                        {signedInCustomer.email}
                      </span>
                    )}
                  </div>
                  <a
                    href="/account"
                    className="account-dropdown-link"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                  >
                    <span>My account</span>
                    <span aria-hidden="true"><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <a href="/login" className="login-link">
              Login
            </a>
          )}

          <button

            className="icon-btn bag-btn"

            aria-label="Open shopping bag"

            onClick={() => setCartOpen(true)}

          >

            <FontAwesomeIcon icon={faBagShopping} aria-hidden="true" />
            <span className="cart-count">{cartCount}</span>

          </button>

        </div>

      </header>

      <div className={`search-panel ${searchOpen ? "open" : ""}`}>

        <label htmlFor="searchInput">Find your next favourite</label>

        <div className="search-field">

          <span><FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" /></span>

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

            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />

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

                Explore our products <span><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></span>

              </a>

              <a className="text-link" href="#story">

                Discover our story <span><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></span>

              </a>

            </div>

            <div className="hero-proof">

              <div className="avatar-stack">

                <span><FontAwesomeIcon icon={faLeaf} aria-hidden="true" /></span>

                <span><FontAwesomeIcon icon={faStar} aria-hidden="true" /></span>

                <span><FontAwesomeIcon icon={faHeart} aria-hidden="true" /></span>

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

              aria-label="Dhysem hair-care ritual with nourishing hair oil"

            />

            <div className="floating-note">

              <span className="note-star"><FontAwesomeIcon icon={faStar} aria-hidden="true" /></span>

              <div>

                <strong>Your glow, your rules.</strong>

                <small>Skin-loving and hair-loving essentials.</small>

              </div>

            </div>

            <div className="hero-stamp">

              <span>MADE FOR</span>

              <strong>YOUR<br />RITUAL</strong>

              <span><FontAwesomeIcon icon={faStar} aria-hidden="true" /> EVERY DAY <FontAwesomeIcon icon={faStar} aria-hidden="true" /></span>

            </div>

          </div>

          <div className="hero-bottom-note">SKIN FIRST. ROOTS ALWAYS.</div>

        </section>

        <section className="trust-strip" aria-label="Our promises">

          <div><span><FontAwesomeIcon icon={faCheck} aria-hidden="true" /></span> Curated with care</div>

          <div><span><FontAwesomeIcon icon={faHeart} aria-hidden="true" /></span> Everyday nourishment</div>

          <div><span><FontAwesomeIcon icon={faLeaf} aria-hidden="true" /></span> Skin &amp; hair essentials</div>

          <div><span><FontAwesomeIcon icon={faStar} aria-hidden="true" /></span> Easy, thoughtful shopping</div>

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

                THOUGHTFUL CARE, EVERY DAY <FontAwesomeIcon icon={faStar} aria-hidden="true" />

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

                  onClick={() => chooseCategoryCard(category.name)}

                >

                  <span className={`category-image ${category.image}`} />

                  <span className="category-card-copy">

                    <strong>{category.title}</strong>

                    <small>{category.desc} <b><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></b></small>

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
    <article
      className="product-card"
      key={product.id}
      role="link"
      tabIndex={0}
      aria-label={`View ${product.name} details`}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a")) return;
        router.push(`/products/${encodeURIComponent(product.slug)}`);
      }}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          router.push(`/products/${encodeURIComponent(product.slug)}`);
        }
      }}
    >
      <div className="product-visual">
        <Image
          src={product.image || "/images/dhysem-hero.jpg"}
          alt={product.name}
          fill
          unoptimized
          sizes="(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw"
          className="object-cover transition-transform duration-500"
        />

        {product.badge && (
          <span className="product-badge">{product.badge}</span>
        )}

        <button
          className={liked.includes(product.id) ? "wishlist liked" : "wishlist"}
          aria-label="Toggle wishlist"
          onClick={() => {
            const alreadyLiked = liked.includes(product.id);

            setLiked((current) =>
              alreadyLiked
                ? current.filter((id) => id !== product.id)
                : [...current, product.id]
            );

            notify(
              alreadyLiked
                ? "Removed from your wishlist"
                : "Saved to your wishlist"
            );
          }}
        >
          <FontAwesomeIcon
            icon={faHeart}
            aria-hidden="true"
            className={
              liked.includes(product.id)
                ? "wishlist-icon is-active"
                : "wishlist-icon"
            }
          />
        </button>

        <button
          className="quick-add"
          onClick={() => addToCart(product.id)}
        >
          Add to bag
          <span>
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          </span>
        </button>
      </div>

      <div className="product-info">
        <div className="product-category">{product.category}</div>

        <div className="product-name-row">
          <h3 className="product-name">{product.name}</h3>

          {product.rating > 0 && (
            <div className="rating">
              <FontAwesomeIcon icon={faStar} aria-hidden="true" />
              {" "}{product.rating.toFixed(1)}{" "}
              <span>({product.reviews})</span>
            </div>
          )}
        </div>

        <div className="product-price">
          <span className="price-current">{money(product.price)}</span>

          {product.oldPrice && (
            <span className="price-old">{money(product.oldPrice)}</span>
          )}
        </div>

        <p className="product-detail">{product.detail}</p>

        <div className="product-bottom">
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

              <span><FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" /></span>

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

              Explore all essentials <span><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></span>

            </button>

          </div>

        </section>

        <section className="dhysem-story" id="story">
  <div className="dhysem-story-inner">

    <div className="dhysem-story-visual">
      <div className="story-image-main">
        <div className="story-image-label">
          <span>THE DHYSEM EDIT</span>
          <strong>Care, with intention.</strong>
        </div>
      </div>

      <div className="story-image-detail" />

      <div className="story-roundel">
        <span>BEAUTY</span>
        <strong>In your<br />own way.</strong>
        <span>ALWAYS.</span>
      </div>

      <div className="story-image-index">
        <span>01</span>
        <i />
        <span>02</span>
      </div>
    </div>

    <div className="dhysem-story-copy">
      <p className="story-eyebrow">
        <span /> THE DHYSEM STORY
      </p>

      <h2>
        Beauty is in
        <br />
        the little <em>things.</em>
      </h2>

      <p className="story-lead">
        The moments you make time for. The care you give yourself.
        The little rituals that remind you to feel good in your own skin.
      </p>

      <p className="story-description">
        At Dhysem, we believe everyday beauty should feel personal,
        uncomplicated and entirely your own. That is why we bring
        together body oils, nourishing creams and hair oils to make
        caring for yourself a pleasure, not another task on your list.
      </p>

      <div className="story-pillars">
        <div className="story-pillar">
          <span>01</span>
          <div>
            <strong>Thoughtful care</strong>
            <p>Essentials chosen with your everyday routine in mind.</p>
          </div>
        </div>

        <div className="story-pillar">
          <span>02</span>
          <div>
            <strong>Your kind of beauty</strong>
            <p>Personal care that celebrates your individual style.</p>
          </div>
        </div>

        <div className="story-pillar">
          <span>03</span>
          <div>
            <strong>Little daily rituals</strong>
            <p>Simple moments that make looking after yourself matter.</p>
          </div>
        </div>
      </div>

      <a className="story-cta" href="#shop">
        Shop the essentials <span>{"\u2192"}</span>
      </a>

      <div className="story-signature">
        A little more you, every day.
        <span>{"\u2713"}</span>
      </div>
    </div>

  </div>
</section>
<Testimonials />

        <section className="newsletter section-wrap">


          <div className="newsletter-icon" aria-hidden="true">D</div>

          <p className="eyebrow">NOTES FROM OUR WORLD</p>

          <h2>A little care in<br />your <em>inbox.</em></h2>

          <p>Join our world of beauty notes and enjoy <strong>10% off your first order.</strong></p>

          <form

            className="newsletter-form"

            onSubmit={(event) => {

              event.preventDefault();

              setNewsletterMessage("Thanks for joining Dhysem's care notes!");

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

            <button type="submit">Count me in <span><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></span></button>

          </form>

          <small className="newsletter-note">{newsletterMessage || "No spam, unsubscribe anytime."}</small>

        </section>

      </main>

      <footer className="site-footer" id="site-footer">

  <div className="footer-main">

    <div className="footer-brand-column">
      <a className="brand" href="#top">dhysem<span>.</span></a>
      <p className="footer-tagline">Body &amp; hair care,<br /><em>beautifully chosen.</em></p>

      <div className="footer-socials" aria-label="Social media and email">
        <a href="#top" aria-label="Facebook" className="footer-social-icon"><FontAwesomeIcon icon={faFacebookF} /></a>
        <a href="#top" aria-label="Instagram" className="footer-social-icon"><FontAwesomeIcon icon={faInstagram} /></a>
        <a href="#top" aria-label="TikTok" className="footer-social-icon"><FontAwesomeIcon icon={faTiktok} /></a>
        <a href="mailto:hello@bigfred.example" aria-label="Email" className="footer-social-icon"><FontAwesomeIcon icon={faEnvelope} /></a>
      </div>
    </div>

    <div className="footer-column">
      <h3>SHOP</h3>
      <a href="#shop">All products</a>
      <a href="#shop">Body oils</a>
      <a href="#shop">Body creams</a>
      <a href="#shop">Hair oils</a>
    </div>

    <div className="footer-column">
      <h3>HELP</h3>
      <a href="mailto:hello@bigfred.example?subject=Shipping%20and%20delivery">Shipping &amp; delivery</a>
      <a href="mailto:hello@bigfred.example?subject=Returns">Returns</a>
      <a href="mailto:hello@bigfred.example?subject=FAQs">FAQs</a>
      <a href="mailto:hello@bigfred.example">Contact</a>
    </div>

    <div className="footer-column">
      <h3>DHYSEM</h3>
      <a href="#story">Our story</a>
      <a href="#customer-reviews">Reviews</a>
      <a href="#newsletter">Care notes</a>
    </div>

  </div>

  <div className="footer-bottom">
    <small>&copy; 2026 Dhysem. All rights reserved.</small>

    <div className="footer-trust">
      <span>Delivery across Ghana</span>
      <span>Mobile Money · Visa · Mastercard</span>
    </div>

    <div className="footer-bottom-right">
      <a href="#privacy">Privacy</a>
      <a href="#terms">Terms</a>
      <a href="#top" className="footer-back-top" aria-label="Back to top">↑</a>
    </div>
  </div>

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

                  ? "Welcome to Dhysem"

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

            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />

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

                <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" /> Back to your bag

              </button>

              <div className="checkout-intro">

                <h3>Your care ritual awaits.</h3>

                <p>

                  Please sign in to your Dhysem account before proceeding

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

                        {product.name} {"\u00D7"} {item.qty}

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

                  Sign in to continue <span><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></span>

                </a>

                <a

                  href="/register"

                  className="button button-outline checkout-submit"

                >

                  Create an account

                </a>

              </div>

              <small className="checkout-secure-note">

                <FontAwesomeIcon icon={faHeart} aria-hidden="true" /> Your Dhysem account keeps your orders and details together.

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

                <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" /> Back to your bag

              </button>

              <div className="checkout-intro">

                <h3>Almost yours.</h3>

                <p>

                  Enter your delivery details below. We&apos;ll prepare your order

                  and connect you to Dhysem on WhatsApp for confirmation.

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

                  <small>Retrieved from your Dhysem account.</small>

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

                        {product.name} {"\u00D7"} {item.qty}

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

                  Final order totals are calculated by Dhysem when your

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

                {!checkoutLoading && <span><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></span>}

              </button>

              <small className="checkout-secure-note">

                <FontAwesomeIcon icon={faHeart} aria-hidden="true" /> No online payment required. Confirm your order with us on WhatsApp.

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

                    <Image src={product.image || "/images/dhysem-hero.jpg"} alt={product.name} width={76} height={92} unoptimized />

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

                          <FontAwesomeIcon icon={faMinus} aria-hidden="true" />

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

            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />

                    </button>

                  </div>

                );

              })}

            </div>

            {cartCount === 0 ? (

              <div className="cart-empty">

                <span><FontAwesomeIcon icon={faHeart} aria-hidden="true" /></span>

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

                  {!checkingCustomer && <span><FontAwesomeIcon icon={faArrowRight} aria-hidden="true" /></span>}

                </button>

                <small><FontAwesomeIcon icon={faHeart} aria-hidden="true" /> Thoughtful shopping, made easy</small>

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
