import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Users,
  BarChart,
  Settings as SettingsIcon,
  Shield,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";
import { useNotification } from "@/components/ui/notification";
import { UserDialog } from "@/components/UserDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { theme } = useSettings();
  const notificationSystem = useNotification();
  const { showNotification } = notificationSystem;
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Fetch current user ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.user.id);
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(
          `/api/admin/users?page=${currentPage}&limit=10&search=${searchQuery}`,
          { credentials: 'include' }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, currentPage, searchQuery]);

  const handleSearch = () => {
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleCreateUser = async (userData: { firstName: string; lastName: string; email: string; password: string; isAdmin?: boolean }) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      showNotification({
        message: "User created successfully",
        type: "success"
      });
      
      // Refresh user list
      if (activeTab === 'users') {
        fetchUsers();
      }
    } catch (err) {
      showNotification({
        message: err instanceof Error ? err.message : 'Failed to create user',
        type: "error"
      });
    }
  };

  const handleEditUser = async (userData: { firstName: string; lastName: string; email: string; isAdmin?: boolean }) => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      showNotification({
        message: "User updated successfully",
        type: "success"
      });
      
      // Refresh user list
      if (activeTab === 'users') {
        fetchUsers();
      }
    } catch (err) {
      showNotification({
        message: err instanceof Error ? err.message : 'Failed to update user',
        type: "error"
      });
    }
    setSelectedUser(null);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      showNotification({
        message: "User deleted successfully",
        type: "success"
      });
      
      // Refresh user list
      if (activeTab === 'users') {
        fetchUsers();
      }
    } catch (err) {
      showNotification({
        message: err instanceof Error ? err.message : 'Failed to delete user',
        type: "error"
      });
    }
    setSelectedUser(null);
    setIsDeleteDialogOpen(false);
  };

  

  return (
    <>
      {notificationSystem.NotificationContainer()}
      <div className="flex h-screen">
        {/* Admin Sidebar */}
        <div 
          className={`w-80 h-full fixed left-0 border-r ${
            theme === "dark" 
              ? "bg-gray-900 text-white border-gray-700" 
              : "bg-white text-gray-900 border-gray-200"
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
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
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
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
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
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
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
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-900"
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
              variant={theme === "dark" ? "default" : "outline"}
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
                  <Button 
                    onClick={() => setActiveTab("users")} 
                    variant={theme === "dark" ? "default" : "outline"}
                    className="w-full mt-4"
                  >
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
                  <Button 
                    onClick={() => setActiveTab("analytics")} 
                    variant={theme === "dark" ? "default" : "outline"}
                    className="w-full mt-4"
                  >
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
                  <Button 
                    onClick={() => setLocation("/admin/content")} 
                    variant={theme === "dark" ? "default" : "outline"}
                    className="w-full mt-4"
                  >
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
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="flex items-center gap-4">
                    <Input
                      type="text"
                      placeholder="Search users..."
                      className="max-w-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Button 
                      onClick={handleSearch}
                      variant={theme === "dark" ? "default" : "outline"}
                    >
                      Search
                    </Button>
                  </div>

                  {/* Add User Button */}
                  <div className="mb-4">
                    <Button
                      onClick={() => {
                        setSelectedUser(null);
                        setIsUserDialogOpen(true);
                      }}
                      variant={theme === "dark" ? "default" : "outline"}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add User
                    </Button>
                  </div>

                  {/* Users Table */}
                  <div className="relative overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className={`text-xs uppercase ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"}`}>
                        <tr>
                          <th className="px-6 py-3">Name</th>
                          <th className="px-6 py-3">Email</th>
                          <th className="px-6 py-3">Role</th>
                          <th className="px-6 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center">
                              Loading users...
                            </td>
                          </tr>
                        ) : error ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-red-500">
                              {error}
                            </td>
                          </tr>
                        ) : users.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center">
                              No users found
                            </td>
                          </tr>
                        ) : (
                          users.map((user) => (
                            <tr key={user.id} className={`border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                              <td className="px-6 py-4">
                                {user.firstName} {user.lastName}
                              </td>
                              <td className="px-6 py-4">{user.email}</td>
                              <td className="px-6 py-4">
                                {user.isAdmin ? "Admin" : "User"}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant={theme === "dark" ? "default" : "outline"}
                                    size="icon"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setIsUserDialogOpen(true);
                                    }}
                                    disabled={user.id === currentUserId}
                                  >
                                    <Pencil className="h-4 w-4" />
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

                  {/* User Dialog */}
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

                  {/* Delete Confirmation Dialog */}
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
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant={theme === "dark" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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
    </>
  );
}
