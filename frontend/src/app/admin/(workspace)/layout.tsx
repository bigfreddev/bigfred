
"use client";

import { Poppins } from "next/font/google";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { AdminProvider } from "@/components/admin/AdminContext";
import api from "@/lib/api";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

interface Admin {
  name: string;
  email: string;
}

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard Overview",
  "/admin/products": "Products Management",
  "/admin/categories": "Categories Management",
  "/admin/orders": "Orders Management",
  "/admin/promotions": "Promotions Management",
  "/admin/reviews": "Customer Reviews",
  "/admin/settings": "Store Settings",
};

export default function AdminWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async () => {
      try {
        const response = await api.get("/admin/me");

        const user =
          response.data?.user ??
          response.data?.admin ??
          response.data;

        if (!mounted) return;

        setAdmin({
          name: user?.name || user?.email || "Administrator",
          email: user?.email || "",
        });
      } catch (error) {
        console.error("Admin authentication check failed:", error);

        if (mounted) {
          router.replace("/admin/login");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading || !admin) {
    return (
      <div
        className={`${poppins.variable} admin-workspace flex min-h-screen items-center justify-center bg-[#faf7f4]`}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#d5a0a1] border-t-transparent" />
          <p className="text-sm text-[#49352f]">
            Loading BigFred Admin Workspace...
          </p>
        </div>
      </div>
    );
  }

  const adminInitials = admin.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const pageTitle =
    pageTitles[pathname] ||
    Object.entries(pageTitles).find(([path]) =>
      pathname.startsWith(`${path}/`)
    )?.[1] ||
    "BigFred Administration";

  return (
    <AdminProvider admin={admin}>
      <div
        className={`${poppins.variable} admin-workspace min-h-screen bg-[#f8f5f1]`}
      >
        <AdminSidebar
          adminName={admin.name}
          adminEmail={admin.email}
        />

        <main className="min-h-screen lg:ml-64">
          {/* Shared administrator header */}
          <header className="relative z-30 border-b border-[#eee5df] bg-white/95 backdrop-blur lg:sticky lg:top-0">
            <div className="flex min-h-[76px] items-center justify-between gap-4 px-5 py-4 sm:px-7 lg:px-10">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a66c72] sm:text-xs">
                  BigFred Administration
                </p>

                <h1 className="mt-1 truncate text-lg font-semibold text-[#49352f] sm:text-xl">
                  {pageTitle}
                </h1>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {/* Refresh current admin page */}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  aria-label="Refresh page"
                  title="Refresh page"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#eee5df] bg-white text-[#9c7772] transition hover:bg-[#fbf3f1]"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 7v5h-5" />
                    <path d="M4 17v-5h5" />
                    <path d="M5.64 9A8 8 0 0 1 19 7l1 5M4 12l1 5a8 8 0 0 0 13.36-2" />
                  </svg>
                </button>

                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-[#49352f]">
                    {admin.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#a49a94]">
                    Store Administrator
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ead5d0] bg-[#f7e9e7] text-sm font-semibold text-[#9e686e]">
                  {adminInitials || "BF"}
                </div>
              </div>
            </div>
          </header>

          {children}
        </main>
      </div>
    </AdminProvider>
  );
}
