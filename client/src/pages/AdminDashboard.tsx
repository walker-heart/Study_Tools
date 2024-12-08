import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, Shield, Users2, BarChart3, Settings, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { useSettings } from "@/contexts/SettingsContext";
import { useNotification } from "@/components/ui/notification";
import { UserDialog } from "@/components/UserDialog";
import { PasswordDialog } from "@/components/PasswordDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  theme: string;
}

const ITEMS_PER_PAGE = 10;

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { theme } = useSettings();
  const { showNotification } = useNotification();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "analytics" | "settings">("overview");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Fetch current user ID
  useEffect(() => {
    fetch("/api/auth/check", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUserId(data.user.id);
        }
      })
      .catch((error) => {
        console.error("Error fetching current user:", error);
      });
  }, []);

  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ["users", currentPage, searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?page=${currentPage}&limit=${ITEMS_PER_PAGE}&search=${searchQuery}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      return {
        users: data.users || [],
        pagination: data.pagination || { total: 0, totalPages: 1, page: 1, limit: ITEMS_PER_PAGE }
      };
    },
  });

  const users = usersData?.users || [];
  const totalPages = usersData?.pagination?.totalPages || 1;

  const handleCreateUser = async (data: { firstName: string; lastName: string; email: string; password?: string; isAdmin?: boolean; theme?: string }) => {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          theme: "system", // Set default theme
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create user");
      }

      showNotification({
        message: "User created successfully",
        type: "success",
      });

      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsUserDialogOpen(false);
    } catch (err) {
      showNotification({
        message: err instanceof Error ? err.message : "Failed to create user",
        type: "error",
      });
    }
  };

  const handleEditUser = async (data: { firstName: string; lastName: string; email: string; isAdmin?: boolean; theme?: string }) => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          theme: selectedUser.theme, // Preserve existing theme
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      showNotification({
        message: "User updated successfully",
        type: "success",
      });

      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsUserDialogOpen(false);
    } catch (err) {
      showNotification({
        message: err instanceof Error ? err.message : "Failed to update user",
        type: "error",
      });
    }
    setSelectedUser(null);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      showNotification({
        message: "User deleted successfully",
        type: "success",
      });

      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsDeleteDialogOpen(false);
    } catch (err) {
      showNotification({
        message: err instanceof Error ? err.message : "Failed to delete user",
        type: "error",
      });
    }
    setSelectedUser(null);
    setIsDeleteDialogOpen(false);
  };

  const handlePasswordUpdate = async (data: { password: string }) => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/password`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: data.password }),
      });

      if (!response.ok) {
        throw new Error("Failed to update password");
      }

      showNotification({
        message: "Password updated successfully",
        type: "success",
      });
      
      setIsPasswordDialogOpen(false);
    } catch (err) {
      showNotification({
        message: err instanceof Error ? err.message : "Failed to update password",
        type: "error",
      });
    }
    setSelectedUser(null);
  };

  return (
    <>
      <div className="flex h-screen bg-background dark:bg-[#0B0E14]">
        {/* Sidebar */}
        <div className={`w-80 h-full fixed left-0 border-r border-gray-200 dark:border-gray-700 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-6">Admin Dashboard</h2>
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "overview"
                    ? theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                }`}
              >
                <Shield className="w-5 h-5" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "users"
                    ? theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                }`}
              >
                <Users2 className="w-5 h-5" />
                Users
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "analytics"
                    ? theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${
                  activeTab === "settings"
                    ? theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                }`}
              >
                <Settings className="w-5 h-5" />
                Settings
              </button>
            </nav>
          </div>
          <div className={`absolute bottom-0 w-full p-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <Link href="/dashboard">
              <button className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 py-2 w-full justify-center ${
                theme === 'dark' ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}>
                Return to App
              </button>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-auto ml-80">
          <div className="space-y-8">
            {activeTab === "overview" && (
              <>
                <h1 className="text-3xl font-bold mb-8">Overview</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col">
                    <Card className="bg-white dark:bg-[#111827] h-[200px] flex flex-col justify-between">
                      <CardHeader>
                        <div className="flex items-center space-x-4">
                          <div className="p-3 rounded-lg bg-[#2563EB] dark:bg-blue-500/20">
                            <Users2 className="h-6 w-6 text-white dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription className="text-gray-500 dark:text-gray-400">Manage user accounts and permissions</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="secondary" 
                          className="w-full bg-[#1F2937] hover:bg-[#374151] text-white"
                          onClick={() => setActiveTab("users")}
                        >
                          Manage Users
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col">
                    <Card className="bg-white dark:bg-[#111827] h-[200px] flex flex-col justify-between">
                      <CardHeader>
                        <div className="flex items-center space-x-4">
                          <div className="p-3 rounded-lg bg-[#10B981] dark:bg-emerald-500/20">
                            <BarChart3 className="h-6 w-6 text-white dark:text-emerald-400" />
                          </div>
                          <div>
                            <CardTitle>Analytics</CardTitle>
                            <CardDescription className="text-gray-500 dark:text-gray-400">View usage statistics and trends</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="secondary" 
                          className="w-full bg-[#1F2937] hover:bg-[#374151] text-white"
                          onClick={() => setActiveTab("analytics")}
                        >
                          View Analytics
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col">
                    <Card className="bg-white dark:bg-[#111827] h-[200px] flex flex-col justify-between">
                      <CardHeader>
                        <div className="flex items-center space-x-4">
                          <div className="p-3 rounded-lg bg-[#9333EA] dark:bg-purple-500/20">
                            <BookOpen className="h-6 w-6 text-white dark:text-purple-400" />
                          </div>
                          <div>
                            <CardTitle>Study Content</CardTitle>
                            <CardDescription className="text-gray-500 dark:text-gray-400">Manage flashcards and study materials</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="secondary" 
                          className="w-full bg-[#1F2937] hover:bg-[#374151] text-white"
                        >
                          Manage Content
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}

            {activeTab === "users" && (
              <Card className={`${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                <CardHeader>
                  <CardTitle className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>User Management</CardTitle>
                  <CardDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Manage system users and their roles</CardDescription>
                </CardHeader>
                <CardContent className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                  <div className="flex justify-between mb-6">
                    <div className="flex items-center space-x-2">
                      <Search className="text-gray-400" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedUser(null);
                        setIsUserDialogOpen(true);
                      }}
                      variant="outline"
                      className="bg-white text-gray-900 hover:bg-gray-100"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                          <th className="text-left p-2 font-medium">Name</th>
                          <th className="text-left p-2 font-medium">Email</th>
                          <th className="text-left p-2 font-medium">Role</th>
                          <th className="text-right p-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading ? (
                          <tr>
                            <td colSpan={5} className="text-center py-4">
                              Loading...
                            </td>
                          </tr>
                        ) : error ? (
                          <tr>
                            <td colSpan={5} className="text-center py-4 text-red-500">
                              Error loading users
                            </td>
                          </tr>
                        ) : users.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-4">
                              No users found
                            </td>
                          </tr>
                        ) : (
                          users.map((user: User) => (
                            <tr key={user.id} className="border-t">
                              <td className="p-2">
                                {user.firstName} {user.lastName}
                              </td>
                              <td className="p-2">{user.email}</td>
                              <td className="p-2">
                                {user.isAdmin ? "Admin" : "User"}
                              </td>
                              <td className="p-2 text-right">
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant={theme === "dark" ? "default" : "outline"}
                                    size="icon"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setIsUserDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant={theme === "dark" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setIsPasswordDialogOpen(true);
                                    }}
                                  >
                                    Change Password
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    disabled={user.id === currentUserId}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {!isLoading && !error && users.length > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={theme === "dark" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant={theme === "dark" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "analytics" && (
              <div>
                <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>
                
                {/* Time Settings */}
                <Card className={`mb-8 ${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                  <CardHeader>
                    <CardTitle>Time Range</CardTitle>
                    <div className="flex gap-4 mt-2">
                      <Button variant="outline" className={theme === 'dark' ? 'bg-gray-800' : ''}>
                        Last 24 Hours
                      </Button>
                      <Button variant="outline" className={theme === 'dark' ? 'bg-gray-800' : ''}>
                        Last 7 Days
                      </Button>
                      <Button variant="outline" className={theme === 'dark' ? 'bg-gray-800' : ''}>
                        Last 30 Days
                      </Button>
                      <Button variant="outline" className={theme === 'dark' ? 'bg-gray-800' : ''}>
                        Custom Range
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <Card className={`${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users2 className="h-5 w-5 text-blue-500" />
                        Total Users
                      </CardTitle>
                      <div className="text-3xl font-bold mt-2">-</div>
                      <CardDescription className="flex items-center mt-2 text-green-500">
                        <span className="text-sm">↑ -% from previous period</span>
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className={`${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users2 className="h-5 w-5 text-purple-500" />
                        Active Users
                      </CardTitle>
                      <div className="text-3xl font-bold mt-2">-</div>
                      <CardDescription className="flex items-center mt-2 text-green-500">
                        <span className="text-sm">↑ -% from previous period</span>
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card className={`${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-yellow-500" />
                        Unique IP Addresses
                      </CardTitle>
                      <div className="text-3xl font-bold mt-2">-</div>
                      <CardDescription className="flex items-center mt-2 text-green-500">
                        <span className="text-sm">↑ -% from previous period</span>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                {/* Detailed Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className={`${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                    <CardHeader>
                      <CardTitle>Usage Over Time</CardTitle>
                      <CardDescription>Number of active users by hour</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] flex items-center justify-center text-gray-500">
                        Chart coming soon...
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                    <CardHeader>
                      <CardTitle>Top 5 Active Users</CardTitle>
                      <CardDescription>Most active users in the selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Placeholder for top users list */}
                        <div className="text-gray-500 text-center">
                          No data available
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                    <CardHeader>
                      <CardTitle>Countries</CardTitle>
                      <CardDescription>User distribution by country</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Placeholder for countries list */}
                        <div className="text-gray-500 text-center">
                          No data available
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${theme === 'dark' ? 'bg-[#111827]' : 'bg-white'}`}>
                    <CardHeader>
                      <CardTitle>Content Statistics</CardTitle>
                      <CardDescription>Flashcards and Memorization Stats</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span>Total Flashcard Sets</span>
                          <span>-</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Total Memorizations</span>
                          <span>-</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div>
                <h1 className="text-3xl font-bold mb-8">Admin Settings</h1>
                <Card>
                  <CardHeader>
                    <CardTitle>Admin Settings</CardTitle>
                    <CardDescription>
                      Admin settings interface coming soon...
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <UserDialog
        isOpen={isUserDialogOpen}
        onClose={() => {
          setIsUserDialogOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={selectedUser ? handleEditUser : handleCreateUser}
        title={selectedUser ? "Edit User" : "Create User"}
        initialData={selectedUser || undefined}
      />

      <PasswordDialog
        isOpen={isPasswordDialogOpen}
        onClose={() => {
          setIsPasswordDialogOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={handlePasswordUpdate}
        title="Change Password"
        userId={selectedUser?.id || 0}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
