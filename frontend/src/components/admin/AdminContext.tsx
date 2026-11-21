
"use client";

import { createContext, useContext } from "react";

export interface AdminUser {
  name: string;
  email: string;
}

interface AdminContextType {
  admin: AdminUser;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({
  admin,
  children,
}: {
  admin: AdminUser;
  children: React.ReactNode;
}) {
  return (
    <AdminContext.Provider value={{ admin }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);

  if (!context) {
    throw new Error("useAdmin must be used inside AdminProvider");
  }

  return context;
}
