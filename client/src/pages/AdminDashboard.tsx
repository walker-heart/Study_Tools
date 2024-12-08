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
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"users" | "analytics" | "settings">("users");
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

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["users", currentPage, searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users?page=${currentPage}&search=${searchQuery}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
  });

  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);

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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex space-x-4">
            <Button
              variant={activeTab === "users" ? "default" : "outline"}
              onClick={() => setActiveTab("users")}
            >
              Users
            </Button>
            <Button
              variant={activeTab === "analytics" ? "default" : "outline"}
              onClick={() => setActiveTab("analytics")}
            >
              Analytics
            </Button>
            <Button
              variant={activeTab === "settings" ? "default" : "outline"}
              onClick={() => setActiveTab("settings")}
            >
              Settings
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {activeTab === "users" && (
            <div>
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
