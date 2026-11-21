
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import "../../Bigfred.css";

type OrderItem = {
  id: number;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
};

type CustomerOrder = {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  created_at: string;
  delivery_address: string;
  delivery_location?: string | null;
  items: OrderItem[];
};

const money = (amount: number) =>
  `GH₵${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");

  useEffect(() => {
    const savedWhatsAppUrl = sessionStorage.getItem(
      "bigfred_pending_whatsapp_url"
    );

    if (savedWhatsAppUrl) {
      setWhatsappUrl(savedWhatsAppUrl);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/customer/orders/${encodeURIComponent(params.id)}`
        );

        if (!isMounted) return;

        const savedOrder = response.data?.data;

        if (!savedOrder) {
          throw new Error("Order details could not be found.");
        }

        setOrder(savedOrder);
      } catch (err: unknown) {
        const apiError = err as {
          response?: {
            status?: number;
            data?: {
              message?: string;
            };
          };
        };

        if (isMounted) {
          setError(
            apiError.response?.data?.message ||
              (apiError.response?.status === 401
                ? "Please sign in to view your order."
                : "We couldn't retrieve your order. Please try again.")
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (params.id) {
      loadOrder();
    }

    return () => {
      isMounted = false;
    };
  }, [params.id]);

  const openWhatsApp = () => {
    if (!whatsappUrl) return;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <main className="bf-confirm-page">
        <div className="bf-confirm-card">
          <div className="bf-confirm-mark">✳</div>
          <p className="bf-confirm-eyebrow">BIGFRED ORDER</p>
          <h1>Preparing your confirmation...</h1>
          <p>Please wait while we retrieve your order details.</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="bf-confirm-page">
        <div className="bf-confirm-card">
          <div className="bf-confirm-mark">♡</div>
          <p className="bf-confirm-eyebrow">BIGFRED</p>
          <h1>We couldn't load your order.</h1>
          <p>{error || "Please try again from your account."}</p>

          <div className="bf-confirm-actions">
            <Link href="/account" className="bf-confirm-primary">
              Go to my account
            </Link>
            <Link href="/" className="bf-confirm-secondary">
              Return to shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bf-confirm-page">
      <div className="bf-confirm-card">
        <Link href="/" className="bf-confirm-brand">
          bigfred<span>.</span>
        </Link>

        <div className="bf-confirm-mark">✓</div>

        <p className="bf-confirm-eyebrow">ORDER SUCCESSFULLY PLACED</p>

        <h1>Thank you for choosing BigFred.</h1>

        <p className="bf-confirm-message">
          Your order has been received and saved. We're looking forward to
          preparing your care essentials.
        </p>

        <div className="bf-confirm-order-number">
          <span>YOUR ORDER NUMBER</span>
          <strong>{order.order_number}</strong>
        </div>

        <div className="bf-confirm-status">
          <div>
            <span>Order status</span>
            <strong>{String(order.status).replaceAll("_", " ")}</strong>
          </div>
          <div>
            <span>Payment status</span>
            <strong>{String(order.payment_status).replaceAll("_", " ")}</strong>
          </div>
          <div>
            <span>Order date</span>
            <strong>
              {new Date(order.created_at).toLocaleDateString("en-GH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </strong>
          </div>
        </div>

        <div className="bf-confirm-items">
          <h2>Order summary</h2>

          {(order.items || []).map((item) => (
            <div className="bf-confirm-item" key={item.id}>
              <div>
                <strong>{item.product_name}</strong>
                <span>
                  {item.quantity} × {money(Number(item.unit_price))}
                </span>
              </div>
              <strong>{money(Number(item.line_total))}</strong>
            </div>
          ))}

          <div className="bf-confirm-total-line">
            <span>Subtotal</span>
            <strong>{money(Number(order.subtotal))}</strong>
          </div>

          <div className="bf-confirm-total-line">
            <span>Delivery fee</span>
            <strong>{money(Number(order.delivery_fee || 0))}</strong>
          </div>

          <div className="bf-confirm-grand-total">
            <span>Total</span>
            <strong>{money(Number(order.total))}</strong>
          </div>
        </div>

        <div className="bf-confirm-delivery">
          <h2>Delivery details</h2>
          <p>{order.delivery_address}</p>
          {order.delivery_location && <p>{order.delivery_location}</p>}
        </div>

        <div className="bf-confirm-whatsapp">
          <h2>One last step</h2>
          <p>
            Continue to WhatsApp so our team can confirm your order and
            coordinate delivery.
          </p>

          {whatsappUrl ? (
            <button
              type="button"
              onClick={openWhatsApp}
              className="bf-confirm-whatsapp-button"
            >
              Continue to WhatsApp <span>→</span>
            </button>
          ) : (
            <p className="bf-confirm-note">
              Your order is saved. You can also contact BigFred through your
              usual WhatsApp conversation.
            </p>
          )}
        </div>

        <div className="bf-confirm-actions">
          <Link href="/account" className="bf-confirm-primary">
            View my orders
          </Link>
          <Link href="/" className="bf-confirm-secondary">
            Continue shopping
          </Link>
        </div>

        <p className="bf-confirm-footer">
          Thank you for making BigFred part of your everyday ritual. ♡
        </p>
      </div>
    </main>
  );
}
