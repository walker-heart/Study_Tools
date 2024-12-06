import { ReactNode } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { theme } = useSettings();

  return (
    <div className={`min-h-screen transition-all duration-300 ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
      <Sidebar />
      <main className="pl-16 md:pl-20 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
