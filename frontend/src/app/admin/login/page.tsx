"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api, { initializeCsrf } from "@/lib/api";
import axios from "axios";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // Initialise Laravel Sanctum CSRF protection.
      await initializeCsrf();

      // Authenticate the administrator.
      await api.post("/admin/login", {
        email: email.trim(),
        password,
      });

      // Verify the authenticated administrator session.
      const response = await api.get("/admin/me");

      if (!response.data) {
        throw new Error("Unable to verify administrator session.");
      }

      router.push("/admin/dashboard");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message =
          err.response?.data?.message ||
          "Unable to sign in. Please check your credentials.";

        setError(message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f4ef] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-6xl grid md:grid-cols-2 bg-white rounded-3xl overflow-hidden shadow-xl">

        {/* Branding section */}
        <section className="hidden md:flex flex-col justify-between bg-[#ead5d0] p-12">
          <div>
            <Link
              href="/"
              className="text-3xl font-serif font-bold text-[#49352f]"
            >
              BigFred<span className="text-[#a66c72]">.</span>
            </Link>

            <p className="mt-2 text-sm tracking-[0.25em] uppercase text-[#765c56]">
              Beauty & Lifestyle
            </p>
          </div>

          <div className="max-w-md">
            <p className="text-sm uppercase tracking-[0.25em] text-[#8d6262] mb-5">
              Administration Portal
            </p>

            <h1 className="text-5xl font-serif leading-tight text-[#49352f]">
              Manage your beauty business with confidence.
            </h1>

            <p className="mt-6 text-[#765c56] leading-7">
              Manage products, customers, orders and customer experiences
              from one central workspace.
            </p>
          </div>

          <p className="text-sm text-[#765c56]">
            © {new Date().getFullYear()} BigFred. All rights reserved.
          </p>
        </section>

        {/* Login form */}
        <section className="flex items-center justify-center p-7 sm:p-12 lg:p-16">
          <div className="w-full max-w-md">

            <div className="md:hidden mb-12">
              <Link
                href="/"
                className="text-3xl font-serif font-bold text-[#49352f]"
              >
                BigFred<span className="text-[#a66c72]">.</span>
              </Link>
            </div>

            <p className="text-xs uppercase tracking-[0.25em] text-[#a66c72] font-semibold">
              Welcome back
            </p>

            <h2 className="text-4xl font-serif text-[#49352f] mt-3">
              Admin Sign In
            </h2>

            <p className="text-sm text-gray-500 mt-3 mb-9">
              Sign in to access your BigFred administration dashboard.
            </p>

            {error && (
              <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#49352f] mb-2">
                  Email Address
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  required
                  className="w-full rounded-xl border border-[#e6ded8] bg-[#fdfbf9] px-4 py-4 text-sm outline-none transition focus:border-[#b77d83] focus:ring-2 focus:ring-[#b77d83]/15"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-[#49352f]">
                    Password
                  </label>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-[#e6ded8] bg-[#fdfbf9] px-4 py-4 pr-20 text-sm outline-none transition focus:border-[#b77d83] focus:ring-2 focus:ring-[#b77d83]/15"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#a66c72] hover:text-[#49352f]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#49352f] py-4 text-sm font-semibold text-white transition hover:bg-[#654b43] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing you in..." : "Sign In to Dashboard"}
              </button>
            </form>

            <div className="mt-9 text-center">
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-[#a66c72]"
              >
                ← Back to BigFred Store
              </Link>
            </div>

            <p className="mt-12 text-center text-xs text-gray-400">
              Restricted access · Authorised administrators only
            </p>

          </div>
        </section>
      </div>
    </main>
  );
}