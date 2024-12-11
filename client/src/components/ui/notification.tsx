import { useEffect, useState, createContext, useContext } from "react";

interface NotificationProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
}

interface NotificationContextType {
  showNotification: (notification: NotificationProps) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function Notification({ message, type = "info", duration = 3000, onClose }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const bgColor = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500"
  }[type];

  return (
    <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg text-white ${bgColor}`}>
      {message}
    </div>
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  const showNotification = (notification: NotificationProps) => {
    setNotifications(prev => [...prev, notification]);
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      {notifications.map((props, index) => (
        <Notification
          key={index}
          {...props}
          onClose={() => {
            setNotifications(prev => prev.filter((_, i) => i !== index));
          }}
        />
      ))}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
