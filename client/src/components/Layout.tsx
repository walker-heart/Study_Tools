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
    <div className={`min-h-screen ${theme}`}>
      <div className="flex min-h-screen">
        {showSidebar && <Sidebar />}
        <main className={`flex-1 ${showSidebar ? "pl-64" : ""} bg-background text-foreground`}>
          <div className="container mx-auto px-4 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
