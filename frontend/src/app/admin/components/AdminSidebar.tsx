
"use client";

import { useRouter } from "next/navigation";

type AdminSidebarProps = {
  activePage: string;
  userName: string;
  onLogout: () => void;
  loggingOut?: boolean;
};

const navigation = [
  { name: "Dashboard", icon: "▦", path: "/admin/dashboard" },
  { name: "Products", icon: "◇", path: "/admin/products" },
  { name: "Categories", icon: "▤", path: "/admin/categories" },
  { name: "Orders", icon: "▣", path: "#" },
  { name: "Customers", icon: "♙", path: "#" },
  { name: "Reviews", icon: "☆", path: "/admin/reviews" },
  { name: "Settings", icon: "⚙", path: "#" },
];

export default function AdminSidebar({
  activePage,
  userName,
  onLogout,
  loggingOut = false,
}: AdminSidebarProps) {
  const router = useRouter();

  return (
    <aside className="w-full md:w-64 md:min-h-screen bg-[#49352f] text-white flex flex-col md:fixed md:inset-y-0 md:left-0 md:z-40">
      <div className="px-7 py-7 border-b border-white/10">
        <h1 className="text-3xl font-serif font-bold">
          BigFred<span className="text-[#d5a0a1]">.</span>
        </h1>
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mt-2">
          Admin Workspace
        </p>
      </div>

      <div className="px-5 pt-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 px-3 mb-4">
          Main Menu
        </p>

        <nav className="space-y-2">
          {navigation.map((item) => {
            const isActive = item.name === activePage;
            const isClickable = item.path !== "#";

            return (
              <button
                key={item.name}
                type="button"
                disabled={!isClickable}
                onClick={() => {
                  if (isClickable && !isActive) {
                    router.push(item.path);
                  }
                }}
                className={`w-full flex items-center gap-4 rounded-xl px-4 py-3 text-sm text-left transition ${
                  isActive
                    ? "bg-[#d5a0a1] text-[#49352f] font-semibold"
                    : isClickable
                    ? "text-white/70 hover:bg-white/10"
                    : "text-white/40 cursor-not-allowed opacity-60"
                }`}
              >
                <span className="text-lg w-5 text-center">{item.icon}</span>
                {item.name}

                {isActive && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-[#49352f]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-5 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="h-10 w-10 rounded-full bg-[#d5a0a1] flex items-center justify-center text-[#49352f] font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{userName}</p>
            <p className="text-xs text-white/50">Administrator</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="w-full text-left text-sm text-white/70 hover:text-white px-3 py-3 mt-2 transition disabled:opacity-50"
        >
          {loggingOut ? "Signing out..." : "↪ Sign Out"}
        </button>
      </div>
    </aside>
  );
}
