import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { theme } = useSettings();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/api/auth/check-admin", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    };

    checkAdminStatus();
  }, []);

  return (
    <div
      className={`fixed left-0 top-0 h-full z-50 transition-all duration-200 ease-in-out ${isOpen ? "translate-x-0 shadow-lg" : "-translate-x-40"}`}
    >
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute right-0 top-4 translate-x-full rounded-l-none border-l-0 ${theme === "dark" ? "bg-gray-800 text-white hover:bg-gray-700" : "bg-white hover:bg-gray-100"}`}
      >
        {isOpen ? "←" : "→"}
      </Button>

      {/* Sidebar content */}
      <div
        className={`h-full w-48 flex flex-col shadow-xl border-r ${theme === "dark" ? "bg-gray-800 text-white border-gray-700" : "bg-white border-gray-200"}`}
      >
        {/* Main navigation */}
        <div className="flex-1 p-4 space-y-4">
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start">
              🏠 Home
            </Button>
          </Link>

          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowTools(!showTools)}
            >
              🛠️ Tools {showTools ? "▼" : "▶"}
            </Button>
            {showTools && (
              <div className="pl-4 space-y-2">
                <Link href="/flashcards">
                  <Button variant="ghost" className="w-full justify-start">
                    📝 Flashcards
                  </Button>
                </Link>
                <Link href="/memorization">
                  <Button variant="ghost" className="w-full justify-start">
                    🧠 Memorization
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Settings button at bottom */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {isAdmin && (
            <Link href="/admin/dashboard">
              <Button variant="ghost" className="w-full justify-start">
                🛠️ Admin Dashboard
              </Button>
            </Link>
          )}
          <Link href="/settings">
            <Button variant="ghost" className="w-full justify-start">
              ⚙️ Settings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
