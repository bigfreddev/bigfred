
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import axios from "axios";
import api, { initializeCsrf } from "@/lib/api";

export default function RegisterPage() {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password || !passwordConfirmation) {
      setError("Please complete all required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // Initialise Laravel Sanctum CSRF protection.
      await initializeCsrf();

      // Register the customer.
      await api.post("/customer/register", {
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });

      // Verify the newly authenticated customer session.
      await api.get("/customer/me");

      setSuccess(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const validationErrors = err.response?.data?.errors;

        if (validationErrors) {
          const firstError = Object.values(
            validationErrors as Record<string, string[]>
          )[0];

          setError(firstError?.[0] || "Please check your information.");
        } else {
          setError(
            err.response?.data?.message ||
              "Unable to create your account. Please try again."
          );
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-[#f8f4ef] flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 sm:p-12 text-center">
          <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5e8e6] text-3xl text-[#a66c72]">
            ✓
          </div>

          <p className="text-xs uppercase tracking-[0.25em] text-[#a66c72] font-semibold">
            Welcome to Dhysem
          </p>

          <h1 className="mt-4 text-4xl font-serif text-[#49352f]">
            Your account is ready!
          </h1>

          <p className="mt-5 text-sm leading-7 text-gray-500">
            Thank you for joining Dhysem, {name.trim()}. Your account has
            been created successfully and you are now signed in.
          </p>

          <Link
            href="/"
            className="mt-9 block w-full rounded-xl bg-[#49352f] py-4 text-sm font-semibold text-white transition hover:bg-[#654b43]"
          >
            Explore Dhysem Store
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f4ef] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-6xl grid md:grid-cols-2 bg-white rounded-3xl overflow-hidden shadow-xl">

        {/* Branding panel */}
        <section className="hidden md:flex flex-col justify-between bg-[#ead5d0] p-12">
          <div>
            <Link
              href="/"
              className="text-3xl font-serif font-bold text-[#49352f]"
            >
              Dhysem<span className="text-[#a66c72]">.</span>
            </Link>

            <p className="mt-2 text-sm tracking-[0.25em] uppercase text-[#765c56]">
              Beauty & Lifestyle
            </p>
          </div>

          <div className="max-w-md">
            <p className="text-sm uppercase tracking-[0.25em] text-[#8d6262] mb-5">
              Your beauty journey starts here
            </p>

            <h1 className="text-5xl font-serif leading-tight text-[#49352f]">
              Beauty begins with taking care of yourself.
            </h1>

            <p className="mt-6 text-[#765c56] leading-7">
              Create your Dhysem account and enjoy a more personal shopping
              experience, with easy access to your profile and orders.
            </p>
          </div>

          <p className="text-sm text-[#765c56]">
            © {new Date().getFullYear()} Dhysem. All rights reserved.
          </p>
        </section>

        {/* Registration form */}
        <section className="flex items-center justify-center p-7 sm:p-12 lg:p-16">
          <div className="w-full max-w-md">

            <div className="md:hidden mb-10">
              <Link
                href="/"
                className="text-3xl font-serif font-bold text-[#49352f]"
              >
                Dhysem<span className="text-[#a66c72]">.</span>
              </Link>
            </div>

            <p className="text-xs uppercase tracking-[0.25em] text-[#a66c72] font-semibold">
              Join the Dhysem family
            </p>

            <h2 className="text-4xl font-serif text-[#49352f] mt-3">
              Create Account
            </h2>

            <p className="text-sm text-gray-500 mt-3 mb-8">
              Create an account to enjoy a more personal shopping experience.
            </p>

            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">

              {/* Full name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-[#49352f] mb-2"
                >
                  Full Name
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  maxLength={255}
                  required
                  className="w-full rounded-xl border border-[#e6ded8] bg-[#fdfbf9] px-4 py-4 text-sm outline-none transition focus:border-[#b77d83] focus:ring-2 focus:ring-[#b77d83]/15"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-[#49352f] mb-2"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-[#e6ded8] bg-[#fdfbf9] px-4 py-4 text-sm outline-none transition focus:border-[#b77d83] focus:ring-2 focus:ring-[#b77d83]/15"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[#49352f] mb-2"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={8}
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

                <p className="mt-2 text-xs text-gray-400">
                  Use at least 8 characters.
                </p>
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="password_confirmation"
                  className="block text-sm font-medium text-[#49352f] mb-2"
                >
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    id="password_confirmation"
                    type={showConfirmation ? "text" : "password"}
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-[#e6ded8] bg-[#fdfbf9] px-4 py-4 pr-20 text-sm outline-none transition focus:border-[#b77d83] focus:ring-2 focus:ring-[#b77d83]/15"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmation(!showConfirmation)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#a66c72] hover:text-[#49352f]"
                  >
                    {showConfirmation ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#49352f] py-4 text-sm font-semibold text-white transition hover:bg-[#654b43] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating your account..." : "Create My Account"}
              </button>
            </form>

            {/* Login link */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[#a66c72] hover:text-[#49352f]"
                >
                  Sign in
                </Link>
              </p>
            </div>

            <div className="mt-7 text-center">
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-[#a66c72]"
              >
                ← Back to Dhysem Store
              </Link>
            </div>

            <p className="mt-10 text-center text-xs text-gray-400">
              Your Dhysem account · Your beauty shopping experience
            </p>

          </div>
        </section>
      </div>
    </main>
  );
}
