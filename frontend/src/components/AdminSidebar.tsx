
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import api from "@/lib/api";

interface AdminSidebarProps {
  adminName?: string;
  adminEmail?: string;
}

const navigation = [
  { name: "Dashboard", path: "/admin/dashboard", icon: "dashboard" },
  { name: "Products", path: "/admin/products", icon: "products" },
  { name: "Categories", path: "/admin/categories", icon: "categories" },
  { name: "Orders", path: "/admin/orders", icon: "orders" },
  { name: "Reviews", path: "/admin/reviews", icon: "reviews" },
  { name: "Settings", path: "/admin/settings", icon: "settings" },
];

function NavIcon({ name }: { name: string }) {
  const common = {
    className: "h-[19px] w-[19px]",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "products":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      );
    case "categories":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case "orders":
      return (
        <svg {...common}>
          <path d="M5 4h14v17H5z" />
          <path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h3" />
        </svg>
      );
    case "reviews":
      return (
        <svg {...common}>
          <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.9h-3l-.3-1.9a8 8 0 0 1-1.8-1l-1.7.7-1.5-2.6 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.5-2.6 1.7.7a8 8 0 0 1 1.8-1l.3-1.9h3l.3 1.9a8 8 0 0 1 1.8 1l1.7-.7 1.5 2.6-1.4 1.1a8 8 0 0 1 0 2Z" />
        </svg>
      );
  }
}

export default function AdminSidebar({
  adminName = "Administrator",
  adminEmail = "",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const activePage =
    navigation.find(
      (item) =>
        pathname === item.path || pathname.startsWith(`${item.path}/`)
    )?.name ?? "Admin Workspace";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await api.post("/admin/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      router.replace("/admin/login");
    }
  };

  const renderBrand = (mobile = false) => (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d5a0a1]/30 bg-[#d5a0a1]/15 font-serif text-lg font-bold text-[#e8b9ba]">
        BF
      </div>

      <div>
        <h1 className="font-serif text-[25px] font-bold leading-none tracking-tight text-white">
          BigFred<span className="text-[#d5a0a1]">.</span>
        </h1>
        <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[2.5px] text-white/40">
          Admin Workspace
        </p>
      </div>

      {mobile && (
        <span className="ml-auto text-[10px] font-medium uppercase tracking-widest text-white/30">
          Menu
        </span>
      )}
    </div>
  );

  const renderNavigation = (mobile = false) => (
    <nav className="space-y-1.5">
      {navigation.map((item) => {
        const active =
          pathname === item.path || pathname.startsWith(`${item.path}/`);

        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => mobile && setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3.5 rounded-xl px-4 py-3.5 transition-all duration-200 ${
              active
                ? "bg-[#d5a0a1] text-[#382622] shadow-[0_5px_18px_rgba(0,0,0,0.12)]"
                : "text-white/55 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-white/35 text-[#382622]"
                  : "bg-white/[0.045] text-white/55 group-hover:bg-white/10 group-hover:text-[#e8b9ba]"
              }`}
            >
              <NavIcon name={item.icon} />
            </span>

            <span className="flex-1 text-[13px] font-medium tracking-wide">
              {item.name}
            </span>

            {active && (
              <span className="h-1.5 w-1.5 rounded-full bg-[#49352f]" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const renderProfile = () => (
    <div className="border-t border-white/[0.08] p-5">
      <p className="mb-4 px-1 text-[9px] font-semibold uppercase tracking-[2px] text-white/30">
        Account
      </p>

      <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e5b4b5]/30 bg-[#d5a0a1] text-sm font-bold text-[#49352f]">
          {adminName.charAt(0).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">
            {adminName}
          </p>
          <p className="mt-1 truncate text-[10px] text-white/40">
            {adminEmail || "Administrator"}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-medium text-white/50 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-50"
      >
        <svg
          className="h-[18px] w-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
        </svg>
        {loggingOut ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile and tablet top bar */}
      <header className="sticky top-0 z-40 flex h-[76px] items-center justify-between border-b border-[#49352f]/[0.08] bg-[#fffdfa]/95 px-5 shadow-[0_3px_15px_rgba(73,53,47,0.035)] backdrop-blur-xl sm:px-7 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#49352f] font-serif text-sm font-bold text-[#e8b9ba]">
            BF
          </div>

          <div>
            <h1 className="font-serif text-[22px] font-bold leading-none text-[#49352f]">
              BigFred<span className="text-[#d5a0a1]">.</span>
            </h1>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[2px] text-[#a18b80]">
              {activePage}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((previous) => !previous)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="bigfred-mobile-sidebar"
          className={`group flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-xl border transition-all duration-200 ${
            menuOpen
              ? "border-[#49352f] bg-[#49352f]"
              : "border-[#49352f]/10 bg-white shadow-[0_3px_10px_rgba(73,53,47,0.06)] hover:border-[#d5a0a1] hover:bg-[#fcf5f3]"
          }`}
        >
          <span
            className={`h-[1.5px] w-[18px] rounded-full transition-all duration-200 ${
              menuOpen
                ? "translate-y-[6.5px] rotate-45 bg-white"
                : "bg-[#49352f]"
            }`}
          />
          <span
            className={`h-[1.5px] w-[18px] rounded-full transition-all duration-200 ${
              menuOpen ? "opacity-0" : "bg-[#49352f]"
            }`}
          />
          <span
            className={`h-[1.5px] w-[18px] rounded-full transition-all duration-200 ${
              menuOpen
                ? "-translate-y-[6.5px] -rotate-45 bg-white"
                : "bg-[#49352f]"
            }`}
          />
        </button>
      </header>

      {/* Mobile and tablet backdrop */}
      <button
        type="button"
        aria-label="Close navigation menu"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-50 cursor-default bg-[#211714]/55 backdrop-blur-[3px] transition-opacity duration-300 lg:hidden ${
          menuOpen
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
        }`}
      />

      {/* Mobile and tablet drawer */}
      <aside
        id="bigfred-mobile-sidebar"
        aria-hidden={!menuOpen}
        className={`fixed inset-y-0 left-0 z-[60] flex w-[min(86vw,330px)] flex-col bg-[#35231f] text-white shadow-[15px_0_50px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-out lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/[0.08] px-6 py-7">
          <div className="flex items-center justify-between">
            {renderBrand(true)}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              >
                <path d="m18 6-12 12M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-7">
          <p className="mb-5 px-4 text-[9px] font-semibold uppercase tracking-[2.5px] text-white/30">
            Workspace navigation
          </p>
          {renderNavigation(true)}
        </div>

        {renderProfile()}
      </aside>

      {/* Permanent desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.05] bg-[#35231f] text-white shadow-[5px_0_25px_rgba(40,25,20,0.06)] lg:flex">
        <div className="border-b border-white/[0.08] px-6 py-7">
          {renderBrand()}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-8">
          <p className="mb-5 px-4 text-[9px] font-semibold uppercase tracking-[2.5px] text-white/30">
            Workspace navigation
          </p>
          {renderNavigation()}
        </div>

        {renderProfile()}
      </aside>
    </>
  );
}
