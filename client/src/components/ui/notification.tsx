import { useEffect, useState } from "react";

interface NotificationProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
}

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
    <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg text-white ${bgColor} transition-opacity duration-300 z-50`}>
      {message}
    </div>
  );
}

interface NotificationContextValue {
  showNotification: (props: NotificationProps) => void;
}

export const useNotification = () => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  const showNotification = (props: NotificationProps) => {
    setNotifications(prev => [...prev, props]);
  };

  const removeNotification = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  const NotificationContainer = () => (
    <>
      {notifications.map((props, index) => (
        <Notification
          key={index}
          {...props}
          onClose={() => removeNotification(index)}
        />
      ))}
    </>
  );

  return {
    showNotification,
    NotificationContainer
  };
};
