import { ReactNode } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocation } from 'wouter';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { theme } = useSettings();
  const [location] = useLocation();
  const showSidebar = location !== '/' && location !== '/signin' && location !== '/signup';

  return (
    <div className={`min-h-screen transition-all duration-300 ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
      {showSidebar && <Sidebar />}
      <main className={`transition-all duration-300 ${showSidebar ? 'pl-16 md:pl-20' : ''}`}>
        {children}
      </main>
    </div>
  );
}
