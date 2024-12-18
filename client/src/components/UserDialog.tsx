import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSettings } from "@/contexts/SettingsContext";

interface UserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: { 
    firstName: string; 
    lastName: string; 
    email: string; 
    password?: string; 
    isAdmin?: boolean;
    theme?: string;
  }) => Promise<void>;
  title: string;
  initialData?: { 
    firstName: string; 
    lastName: string; 
    email: string; 
    isAdmin?: boolean; 
    theme?: string;
  };
}

export function UserDialog({ isOpen, onClose, onSubmit, title, initialData }: UserDialogProps) {
  const { theme } = useSettings();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    isAdmin: false,
    theme: "system"
  });

  // Update form data when initialData changes or dialog opens
  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName,
        lastName: initialData.lastName,
        email: initialData.email,
        password: "",
        isAdmin: initialData.isAdmin || false,
        theme: initialData.theme || "system"
      });
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        isAdmin: false,
        theme: "system"
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          {!initialData && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!initialData}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Admin Status</Label>
            <RadioGroup
              value={formData.isAdmin ? "yes" : "no"}
              onValueChange={(value) => setFormData({ ...formData, isAdmin: value === "yes" })}
              className="flex flex-row space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="admin-yes" />
                <Label htmlFor="admin-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="admin-no" />
                <Label htmlFor="admin-no">No</Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant={theme === "dark" ? "default" : "outline"}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              variant={theme === "dark" ? "default" : "outline"}
            >
              {initialData ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
