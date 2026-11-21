
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api, { initializeCsrf } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    try {
      setLoading(true);

      await initializeCsrf();

      await api.post("/customer/login", {
        email: email.trim(),
        password,
      });

      await api.get("/customer/me");

      router.push("/account");
    } catch (err: any) {
      const response = err.response?.data;

      const validationError = response?.errors
        ? Object.values(response.errors).flat()[0]
        : null;

      setError(
        (validationError as string) ||
          response?.message ||
          "Unable to sign in. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f4f0] flex items-center justify-center px-4 py-10 sm:px-6">

      <div className="grid w-full max-w-[1000px] min-h-[780px] overflow-hidden rounded-[22px] bg-white shadow-xl lg:grid-cols-2">

        {/* LEFT BRANDING PANEL */}
        <section className="relative flex flex-col justify-between bg-[#ead5cf] p-10 sm:p-12">

          <Link href="/" className="inline-block">
            <h1 className="font-serif text-3xl font-bold text-[#49332b]">
              BigFred.
            </h1>
            <p className="mt-1 text-xs tracking-[0.2em] text-[#765c53]">
              BEAUTY & LIFESTYLE
            </p>
          </Link>

          <div className="relative z-10 my-12">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.25em] text-[#9a7165]">
              WELCOME BACK TO BIGFRED
            </p>

            <h2 className="max-w-sm font-serif text-4xl leading-tight text-[#49332b] sm:text-[40px]">
              Beauty begins with taking care of yourself.
            </h2>

            <p className="mt-6 max-w-sm text-sm leading-7 text-[#765f55]">
              Sign in to your BigFred account and enjoy a more
              personal shopping experience, with easy access to
              your profile, favourite products and orders.
            </p>
          </div>

          <p className="text-xs text-[#765f55]">
            © {new Date().getFullYear()} BigFred. All rights reserved.
          </p>

          <div className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full border border-white/30" />
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-48 w-48 rounded-full border border-white/30" />

        </section>

        {/* RIGHT LOGIN PANEL */}
        <section className="flex items-center justify-center bg-white px-8 py-14 sm:px-14">

          <div className="w-full max-w-[400px]">

            <div className="mb-7">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#a47c70]">
                WELCOME BACK
              </p>

              <h2 className="font-serif text-4xl text-[#49332b]">
                Sign In
              </h2>

              <p className="mt-2 text-xs leading-6 text-[#806b61]">
                Sign in to enjoy a more personal shopping experience.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-medium text-[#49332b]"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-[#e8ddd7] bg-[#fdfbf9] px-3 text-xs text-[#49332b] outline-none transition focus:border-[#b58b7e]"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-medium text-[#49332b]"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-xl border border-[#e8ddd7] bg-[#fdfbf9] px-3 pr-16 text-xs text-[#49332b] outline-none transition focus:border-[#b58b7e]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#a47c70] hover:text-[#49332b]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* ERROR MESSAGE */}
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700"
                >
                  {error}
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full rounded-xl bg-[#49332b] text-xs font-semibold text-white transition hover:bg-[#65483d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>

            </form>

            {/* REGISTER LINK */}
            <p className="mt-7 text-center text-xs text-[#806b61]">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#a45f55] hover:underline"
              >
                Create an account
              </Link>
            </p>

            {/* STORE LINK */}
            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-xs text-[#806b61] hover:text-[#49332b]"
              >
                ← Back to BigFred Store
              </Link>
            </div>

            <p className="mt-9 text-center text-[10px] text-[#a18e85]">
              Your BigFred account · Your beauty shopping experience
            </p>

          </div>
        </section>

      </div>
    </main>
  );
}
