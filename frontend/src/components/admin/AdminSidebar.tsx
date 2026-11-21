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
  { name: "Dashboard", icon: "▦", path: "/admin/dashboard" },
  { name: "Products", icon: "◇", path: "/admin/products" },
  { name: "Categories", icon: "▤", path: "/admin/categories" },
  { name: "Orders", icon: "▣", path: "/admin/orders" },
  { name: "Promotions", icon: "％", path: "/admin/promotions" },
  { name: "Reviews", icon: "☆", path: "/admin/reviews" },
  { name: "Settings", icon: "⚙", path: "/admin/settings" },
];

export default function AdminSidebar({
  adminName = "Administrator",
  adminEmail = "",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);

  const renderNavigation = (mobile = false) => (
    <nav className="space-y-2">
      {navigation.map((item) => {
        const active = isActive(item.path);

        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => mobile && setMenuOpen(false)}
            className={`flex items-center gap-4 rounded-xl px-4 py-3.5 transition-all ${
              active
                ? "bg-[#d5a0a1] font-semibold text-[#49352f] shadow-md"
                : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center text-xl">
              {item.icon}
            </span>
            <span className="text-sm">{item.name}</span>
            {active && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#49352f]" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const renderProfile = () => (
    <div className="border-t border-white/10 p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#d5a0a1] text-lg font-bold text-[#49352f]">
          {adminName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{adminName}</p>
          <p className="truncate text-xs text-white/45">
            {adminEmail || "Administrator"}
          </p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        <span className="text-lg">↪</span>
        {loggingOut ? "Signing out..." : "Sign Out"}
      </button>
    </div>
  );

  const renderBrand = () => (
    <div className="border-b border-white/10 px-6 py-7">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        BigFred<span className="text-[#d5a0a1]">.</span>
      </h1>
      <p className="mt-2 text-[10px] uppercase tracking-[3px] text-white/40">
        Admin Workspace
      </p>
    </div>
  );

  return (
    <>
      {/* Mobile and tablet top bar */}
      <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-[#49352f]/10 bg-[#fffdfa] px-5 shadow-sm lg:hidden">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#49352f]">
            BigFred<span className="text-[#d5a0a1]">.</span>
          </h1>
          <p className="text-[9px] uppercase tracking-[2px] text-[#9a8177]">
            Admin Workspace
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((previous) => !previous)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="bigfred-mobile-sidebar"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#49352f]/10 bg-white text-[#49352f] shadow-sm"
        >
          {menuOpen ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile and tablet backdrop */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 lg:hidden ${
          menuOpen
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Mobile and tablet drawer */}
      <aside
        id="bigfred-mobile-sidebar"
        className={`fixed inset-y-0 left-0 z-[60] flex w-[min(84vw,320px)] flex-col bg-[#35231f] text-white shadow-2xl transition-transform duration-300 lg:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!menuOpen}
      >
        {renderBrand()}
        <div className="flex-1 overflow-y-auto px-4 py-7">
          <p className="mb-5 px-3 text-[10px] font-semibold uppercase tracking-[2px] text-white/35">
            Main Menu
          </p>
          {renderNavigation(true)}
        </div>
        {renderProfile()}
      </aside>

      {/* Permanent desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#35231f] text-white shadow-xl lg:flex">
        {renderBrand()}
        <div className="flex-1 overflow-y-auto px-4 py-7">
          <p className="mb-5 px-3 text-[10px] font-semibold uppercase tracking-[2px] text-white/35">
            Main Menu
          </p>
          {renderNavigation()}
        </div>
        {renderProfile()}
      </aside>
    </>
  );
}
