import { useState } from "react";
import { useLocation } from "wouter";
import {
  Users,
  BarChart,
  Settings as SettingsIcon,
  Shield,
  BookOpen,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { theme } = useSettings();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex h-screen">
      {/* Admin Sidebar */}
      <div 
        className={`w-80 h-full fixed left-0 border-r ${
          theme === "dark" 
            ? "bg-white text-gray-900 border-gray-200" 
            : "bg-gray-900 text-white border-gray-700"
        }`}
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">Admin Dashboard</h2>
          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${
                activeTab === "overview"
                  ? theme === "dark"
                    ? "bg-gray-100 text-gray-900"
                    : "bg-gray-800 text-white"
                  : "hover:bg-opacity-10 hover:bg-gray-500"
              }`}
            >
              <Shield className="w-5 h-5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${
                activeTab === "users"
                  ? theme === "dark"
                    ? "bg-gray-100 text-gray-900"
                    : "bg-gray-800 text-white"
                  : "hover:bg-opacity-10 hover:bg-gray-500"
              }`}
            >
              <Users className="w-5 h-5" />
              Users
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${
                activeTab === "analytics"
                  ? theme === "dark"
                    ? "bg-gray-100 text-gray-900"
                    : "bg-gray-800 text-white"
                  : "hover:bg-opacity-10 hover:bg-gray-500"
              }`}
            >
              <BarChart className="w-5 h-5" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${
                activeTab === "settings"
                  ? theme === "dark"
                    ? "bg-gray-100 text-gray-900"
                    : "bg-gray-800 text-white"
                  : "hover:bg-opacity-10 hover:bg-gray-500"
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              Settings
            </button>
          </nav>
        </div>
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={() => setLocation("/dashboard")}
            className="w-full justify-center"
          >
            Return to App
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-80 flex-1 p-8 bg-background">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold mb-8">Overview</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className={`p-6 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">User Management</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Manage user accounts and permissions
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
                <Button onClick={() => setActiveTab("users")} className="w-full mt-4">
                  Manage Users
                </Button>
              </Card>

              <Card className={`p-6 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Analytics</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      View usage statistics and trends
                    </p>
                  </div>
                  <BarChart className="w-8 h-8 text-green-500" />
                </div>
                <Button onClick={() => setActiveTab("analytics")} className="w-full mt-4">
                  View Analytics
                </Button>
              </Card>

              <Card className={`p-6 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Study Content</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Manage flashcards and study materials
                    </p>
                  </div>
                  <BookOpen className="w-8 h-8 text-purple-500" />
                </div>
                <Button onClick={() => setLocation("/admin/content")} className="w-full mt-4">
                  Manage Content
                </Button>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div>
            <h1 className="text-3xl font-bold mb-8">User Management</h1>
            <Card className={`p-6 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white"}`}>
              <h2 className="text-2xl font-semibold mb-4">User Management</h2>
              <p className="text-gray-500 dark:text-gray-400">
                User management interface coming soon...
              </p>
            </Card>
          </div>
        )}

        {activeTab === "analytics" && (
          <div>
            <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>
            <Card className={`p-6 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white"}`}>
              <h2 className="text-2xl font-semibold mb-4">Analytics Dashboard</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Analytics dashboard coming soon...
              </p>
            </Card>
          </div>
        )}

        {activeTab === "settings" && (
          <div>
            <h1 className="text-3xl font-bold mb-8">Admin Settings</h1>
            <Card className={`p-6 ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white"}`}>
              <h2 className="text-2xl font-semibold mb-4">Admin Settings</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Admin settings interface coming soon...
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
