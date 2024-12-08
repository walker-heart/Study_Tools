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

  const handleCreateUser = async (data: Omit<User, "id">) => {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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

  const handleEditUser = async (data: Partial<User>) => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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
        <div className="w-64 bg-background dark:bg-[#141820] border-r border-border p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-6">Admin Dashboard</h2>
          <nav className="space-y-2">
            <Button
              variant={activeTab === "overview" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("overview")}
              className="w-full justify-start"
            >
              <Shield className="mr-2 h-4 w-4" />
              Overview
            </Button>
            <Button
              variant={activeTab === "users" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("users")}
              className="w-full justify-start"
            >
              <Users2 className="mr-2 h-4 w-4" />
              Users
            </Button>
            <Button
              variant={activeTab === "analytics" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("analytics")}
              className="w-full justify-start"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
            <Button
              variant={activeTab === "settings" ? "secondary" : "ghost"}
              onClick={() => setActiveTab("settings")}
              className="w-full justify-start"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </nav>
          <div className="mt-auto pt-6">
            <Link href="/dashboard">
              <Button className="w-full" variant="outline">
                Return to App
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="space-y-8">
            {activeTab === "overview" && (
              <>
                <h1 className="text-3xl font-bold mb-8">Overview</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="flex flex-col h-full">
                    <Card className="flex-1">
                      <CardHeader>
                        <div className="flex items-center space-x-4">
                          <div className="p-3 rounded-lg bg-[#2563EB] dark:bg-blue-500/20">
                            <Users2 className="h-6 w-6 text-white dark:text-blue-400" />
                          </div>
                          <div>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>Manage user accounts and permissions</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="secondary" 
                          className="w-full bg-secondary hover:bg-secondary/80"
                          onClick={() => setActiveTab("users")}
                        >
                          Manage Users
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col h-full">
                    <Card className="flex-1">
                      <CardHeader>
                        <div className="flex items-center space-x-4">
                          <div className="p-3 rounded-lg bg-[#10B981] dark:bg-emerald-500/20">
                            <BarChart3 className="h-6 w-6 text-white dark:text-emerald-400" />
                          </div>
                          <div>
                            <CardTitle>Analytics</CardTitle>
                            <CardDescription>View usage statistics and trends</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="secondary" 
                          className="w-full bg-secondary hover:bg-secondary/80"
                          onClick={() => setActiveTab("analytics")}
                        >
                          View Analytics
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex flex-col h-full">
                    <Card className="flex-1">
                      <CardHeader>
                        <div className="flex items-center space-x-4">
                          <div className="p-3 rounded-lg bg-[#9333EA] dark:bg-purple-500/20">
                            <BookOpen className="h-6 w-6 text-white dark:text-purple-400" />
                          </div>
                          <div>
                            <CardTitle>Study Content</CardTitle>
                            <CardDescription>Manage flashcards and study materials</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="secondary" 
                          className="w-full bg-secondary hover:bg-secondary/80"
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
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage system users and their roles</CardDescription>
                </CardHeader>
                <CardContent>
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
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">Role</th>
                          <th className="text-left p-2">Theme</th>
                          <th className="text-right p-2">Actions</th>
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
                              <td className="p-2">{user.theme}</td>
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
                <Card>
                  <CardHeader>
                    <CardTitle>Analytics Dashboard</CardTitle>
                    <CardDescription>
                      Analytics dashboard coming soon...
                    </CardDescription>
                  </CardHeader>
                </Card>
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
