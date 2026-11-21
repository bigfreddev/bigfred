
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/components/admin/AdminContext";
import api from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const { admin } = useAdmin();

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setNotice("");

      const response = await api.get("/settings/whatsapp");

      setWhatsappNumber(
        response.data?.data?.whatsapp_number ?? ""
      );
    } catch (err: any) {
      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        router.push("/admin/login");
        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to load your WhatsApp settings. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setNotice("");
    setError("");

    if (!whatsappNumber.trim()) {
      setError("Please enter your WhatsApp Business number.");
      return;
    }

    try {
      setSaving(true);

      const response = await api.put("/admin/settings/whatsapp", {
        whatsapp_number: whatsappNumber,
      });

      setWhatsappNumber(
        response.data?.data?.whatsapp_number ?? whatsappNumber
      );

      setNotice(
        response.data?.message ||
          "WhatsApp Business number updated successfully."
      );
    } catch (err: any) {
      if (
        err.response?.status === 401 ||
        err.response?.status === 403
      ) {
        router.push("/admin/login");
        return;
      }

      const validationErrors = err.response?.data?.errors;

      if (validationErrors?.whatsapp_number?.length) {
        setError(validationErrors.whatsapp_number[0]);
      } else {
        setError(
          err.response?.data?.message ||
            "Unable to save your WhatsApp number. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleNumberChange = (value: string) => {
    setWhatsappNumber(value);
    setNotice("");
    setError("");
  };

  const isConfigured = Boolean(whatsappNumber.trim());

  return (
    <div className="min-h-screen bg-[#f8f5f1] text-[#49352f]">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">

        {/* Page heading */}
        <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#a66c72]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a66c72]" />
              Store management
            </div>

            <h1 className="font-serif text-3xl tracking-tight text-[#49352f] sm:text-4xl">
              Settings
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
              Manage your store configuration and the way customers
              connect with BigFred.
            </p>

            {admin?.name && (
              <p className="mt-3 text-xs text-gray-400">
                Signed in as {admin.name}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={loadSettings}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#eae1db] bg-white px-5 py-3 text-sm font-medium text-[#49352f] shadow-sm transition hover:border-[#d8c5bd] hover:bg-[#fcfaf8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10m0-6v6h6m-5 3a8.1 8.1 0 0 0 14.8 4L21 14m0 6v-6h-6"
              />
            </svg>
            Refresh settings
          </button>
        </div>

        {/* Notifications */}
        {notice && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800"
          >
            <svg
              className="mt-0.5 h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m5 12 4 4L19 6"
              />
            </svg>
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          >
            <svg
              className="mt-0.5 h-5 w-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path
                strokeLinecap="round"
                d="M12 8v5m0 3h.01"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Settings overview */}
        <div className="mb-7 grid gap-5 lg:grid-cols-[1.5fr_1fr]">

          {/* Main configuration card */}
          <section className="overflow-hidden rounded-2xl border border-[#eee5df] bg-white shadow-[0_4px_20px_rgba(73,53,47,0.035)]">
            <div className="border-b border-[#f0eae5] px-6 py-6 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6e9e7] text-[#a66c72]">
                    <svg
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.7-.9L3 21l1.8-5.1a8.4 8.4 0 1 1 16.2-4.4Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.5 9.5c.5 2.3 2.7 4.5 5 5"
                      />
                    </svg>
                  </div>

                  <div>
                    <h2 className="font-serif text-xl">
                      WhatsApp Business
                    </h2>
                    <p className="mt-1 text-xs text-gray-400">
                      Customer order communication
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Store integration
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {loading ? (
                <div className="animate-pulse space-y-5 py-5">
                  <div className="h-5 w-40 rounded bg-[#f1ece8]" />
                  <div className="h-3 w-3/4 rounded bg-[#f5f1ed]" />
                  <div className="h-12 w-full rounded-xl bg-[#f5f1ed]" />
                  <div className="h-20 w-full rounded-xl bg-[#f5f1ed]" />
                </div>
              ) : (
                <div className="max-w-2xl">
                  <div className="mb-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a66c72]">
                      Order destination
                    </p>

                    <h3 className="mt-2 font-serif text-2xl text-[#49352f]">
                      Where should orders go?
                    </h3>

                    <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                      Set the WhatsApp Business number that receives
                      orders from customers shopping on your BigFred
                      storefront.
                    </p>
                  </div>

                  <form onSubmit={handleSave}>
                    <div className="mb-6">
                      <label
                        htmlFor="whatsapp_number"
                        className="mb-2 block text-sm font-semibold text-[#49352f]"
                      >
                        WhatsApp Business Number
                      </label>

                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                          <span className="text-sm font-semibold text-[#a66c72]">
                            +
                          </span>
                        </div>

                        <input
                          id="whatsapp_number"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={whatsappNumber}
                          onChange={(e) =>
                            handleNumberChange(e.target.value)
                          }
                          placeholder="233XXXXXXXXX"
                          maxLength={20}
                          required
                          className="w-full rounded-xl border border-[#eae1db] bg-[#fcfaf8] py-3.5 pl-9 pr-4 text-sm font-medium text-[#49352f] outline-none transition placeholder:font-normal placeholder:text-gray-400 focus:border-[#b98288] focus:bg-white focus:ring-4 focus:ring-[#b98288]/10"
                        />
                      </div>

                      <p className="mt-2 text-xs leading-5 text-gray-400">
                        Use your full international number, including
                        the country code. For Ghana, start with
                        233. Spaces, hyphens and a plus sign are
                        accepted.
                      </p>
                    </div>

                    {/* Number preview */}
                    <div className="mb-6 rounded-xl border border-[#eee5df] bg-[#fcfaf8] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                            Current order destination
                          </p>

                          <p className="mt-2 break-all text-base font-semibold tracking-wide text-[#49352f]">
                            {whatsappNumber.trim() || "No number configured"}
                          </p>
                        </div>

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf7ef] text-green-700">
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.5 8.5 0 0 1-3.7-.9L3 21l1.8-5.1a8.4 8.4 0 1 1 16.2-4.4Z"
                            />
                          </svg>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 border-t border-[#eee5df] pt-3">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isConfigured
                              ? "bg-green-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            isConfigured
                              ? "text-green-700"
                              : "text-amber-700"
                          }`}
                        >
                          {isConfigured
                            ? "WhatsApp number configured"
                            : "WhatsApp number not configured"}
                        </span>
                      </div>
                    </div>

                    {/* Information panel */}
                    <div className="mb-7 flex items-start gap-3 rounded-xl border border-[#f0e6df] bg-[#fbf7f3] p-5">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#a66c72] shadow-sm">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path
                            strokeLinecap="round"
                            d="M12 11v5m0-8h.01"
                          />
                        </svg>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#49352f]">
                          How this setting works
                        </p>

                        <p className="mt-1 text-sm leading-6 text-gray-500">
                          When a customer places an order, BigFred
                          uses this number to open a WhatsApp
                          conversation with your business. Updating
                          this setting changes the destination
                          without requiring any storefront code
                          changes.
                        </p>
                      </div>
                    </div>

                    {/* Save button */}
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-[#49352f] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35251f] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? (
                          <>
                            <svg
                              className="h-4 w-4 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              aria-hidden="true"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="9"
                                strokeOpacity=".25"
                              />
                              <path
                                strokeLinecap="round"
                                d="M21 12a9 9 0 0 0-9-9"
                              />
                            </svg>
                            Saving changes...
                          </>
                        ) : (
                          <>
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 12h14m-6-6 6 6-6 6"
                              />
                            </svg>
                            Save Changes
                          </>
                        )}
                      </button>

                      {saving && (
                        <span className="text-xs text-gray-400">
                          Updating your store configuration...
                        </span>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>
          </section>

          {/* Side information panel */}
          <aside className="flex flex-col gap-5">
            <div className="overflow-hidden rounded-2xl bg-[#49352f] p-6 text-white shadow-sm sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                <svg
                  className="h-5 w-5 text-[#e8c4bd]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3 4.5 6v5.5c0 4.5 3.2 7.6 7.5 9.5 4.3-1.9 7.5-5 7.5-9.5V6L12 3Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m9 12 2 2 4-4"
                  />
                </svg>
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.17em] text-[#d9b3ad]">
                Store configuration
              </p>

              <h3 className="mt-2 font-serif text-2xl leading-tight">
                Keep your customer connection close.
              </h3>

              <p className="mt-3 text-sm leading-6 text-white/65">
                Your WhatsApp destination connects your storefront
                with your business, making it easier to receive
                customer orders directly.
              </p>

              <div className="mt-7 border-t border-white/15 pt-5">
                <p className="text-xs text-white/50">
                  Configuration status
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      loading
                        ? "bg-white/40"
                        : isConfigured
                          ? "bg-green-400"
                          : "bg-amber-400"
                    }`}
                  />
                  <span className="text-sm font-medium text-white">
                    {loading
                      ? "Checking configuration..."
                      : isConfigured
                        ? "Destination configured"
                        : "Setup required"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#eee5df] bg-white p-6 shadow-[0_4px_20px_rgba(73,53,47,0.035)]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6e9e7] text-[#a66c72]">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 7v5l3 2"
                    />
                  </svg>
                </div>

                <h3 className="font-serif text-lg">
                  Helpful reminders
                </h3>
              </div>

              <ul className="mt-5 space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b98288]" />
                  <p className="text-sm leading-6 text-gray-500">
                    Make sure the number belongs to an active
                    WhatsApp account.
                  </p>
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b98288]" />
                  <p className="text-sm leading-6 text-gray-500">
                    Always include your international country code.
                  </p>
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b98288]" />
                  <p className="text-sm leading-6 text-gray-500">
                    Save your changes after updating the number.
                  </p>
                </li>
              </ul>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center justify-between gap-2 border-t border-[#eae1db] py-6 text-xs text-gray-400 sm:flex-row">
          <span>BigFred Store Configuration</span>
          <span>Manage your store with confidence.</span>
        </div>
      </div>
    </div>
  );
}
