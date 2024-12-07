import { ReactNode } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useLocation } from "wouter";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { theme } = useSettings();
  const [location] = useLocation();
  const showSidebar =
    location !== "/" &&
    location !== "/signin" &&
    location !== "/signup" &&
    location !== "/admin/dashboard";

  return (
    <div
      className={`min-h-screen ${theme === "dark" ? "dark bg-gray-900 text-white" : "bg-white"}`}
    >
      {showSidebar && <Sidebar />}
      <main className={showSidebar ? "ml-0 md:ml-12" : ""}>{children}</main>
    </div>
  );
}
