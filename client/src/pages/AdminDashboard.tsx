import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, UpdateUserData } from "@/types/user";
import { useToast } from "@/components/ui/use-toast";
import {
  Users,
  BarChart,
  Settings as SettingsIcon,
  Shield,
  BookOpen,
} from "lucide-react";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
}

interface ApiError {
  message: string;
}
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { theme } = useSettings();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: currentUser } = useQuery<User>({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/check', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch current user');
      return response.json();
    }
  });

  // Fetch users
  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation<User, Error, UpdateUserData>({
    mutationFn: async (userData) => {
      const response = await fetch(`/api/admin/users/${userData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData)
      });
      if (!response.ok) throw new Error('Failed to update user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsEditDialogOpen(false);
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation<{ message: string }, ApiError, number>({
    mutationFn: async (userId) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    }
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (userId: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUserMutation.mutateAsync(userId);
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const { toast } = useToast();
  
  const handleUpdateUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string | null;
    const lastName = formData.get('lastName') as string | null;
    const email = formData.get('email') as string | null;
    
    if (!firstName || !lastName || !email) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive"
      });
      return;
    }

    const userData: UpdateUserData = {
      id: editingUser.id,
      firstName: String(firstName),
      lastName: String(lastName),
      email: String(email),
      isAdmin: formData.get('isAdmin') === 'true'
    };

    try {
      await updateUserMutation.mutateAsync(userData);
      toast({
        title: "Success",
        description: "User updated successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user",
        variant: "destructive"
      });
    }
  };

  return (
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
            variant="outline"
            onClick={() => setLocation("/dashboard")}
            className={`w-full justify-center ${
              theme === "dark" 
                ? "text-white hover:text-white" 
                : "text-gray-900 hover:text-gray-900"
            }`}
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
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
                  </div>
                ) : error ? (
                  <div className="text-red-500 text-center py-4">
                    Error loading users: {error instanceof Error ? error.message : 'Unknown error'}
                  </div>
                ) : (
                  /* User Management Table */
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                      <tr className={`border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                        <th className="text-left py-3 px-4">ID</th>
                        <th className="text-left py-3 px-4">First Name</th>
                        <th className="text-left py-3 px-4">Last Name</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Admin</th>
                        <th className="text-left py-3 px-4">Created At</th>
                        <th className="text-left py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users?.map((user: User) => (
                        <tr
                          key={user.id}
                          className={`border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"} hover:bg-gray-50 dark:hover:bg-gray-700`}
                        >
                          <td className="py-3 px-4">{user.id}</td>
                          <td className="py-3 px-4">{user.firstName}</td>
                          <td className="py-3 px-4">{user.lastName}</td>
                          <td className="py-3 px-4">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              user.isAdmin
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            }`}>
                              {user.isAdmin ? "Yes" : "No"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(user)}
                                className={theme === "dark" ? "text-white hover:text-white" : ""}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(user.id)}
                                disabled={user.id === currentUser?.id}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
              {updateUserMutation.isError && (
                <div className="mt-4 text-red-500">
                  {updateUserMutation.error instanceof Error 
                    ? updateUserMutation.error.message 
                    : 'Failed to update user'}
                </div>
              )}
              {deleteUserMutation.isError && (
                <div className="mt-4 text-red-500">
                  {deleteUserMutation.error instanceof Error 
                    ? deleteUserMutation.error.message 
                    : 'Failed to delete user'}
                </div>
              )}
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className={theme === "dark" ? "bg-gray-800 text-white" : ""}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  defaultValue={editingUser?.firstName}
                  className={`w-full p-2 rounded-md border ${
                    theme === "dark"
                      ? "bg-gray-700 border-gray-600"
                      : "bg-white border-gray-300"
                  }`}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  defaultValue={editingUser?.lastName}
                  className={`w-full p-2 rounded-md border ${
                    theme === "dark"
                      ? "bg-gray-700 border-gray-600"
                      : "bg-white border-gray-300"
                  }`}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={editingUser?.email}
                className={`w-full p-2 rounded-md border ${
                  theme === "dark"
                    ? "bg-gray-700 border-gray-600"
                    : "bg-white border-gray-300"
                }`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Status</label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="isAdmin"
                    value="true"
                    defaultChecked={editingUser?.isAdmin}
                  />
                  <span>Admin</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="isAdmin"
                    value="false"
                    defaultChecked={!editingUser?.isAdmin}
                  />
                  <span>User</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
