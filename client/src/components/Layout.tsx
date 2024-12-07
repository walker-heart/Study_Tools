import { ReactNode } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocation } from 'wouter';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import PageTransition from './PageTransition';

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
      <main 
        className={`
          transition-all duration-500 ease-in-out transform-gpu
          ${showSidebar ? 'ml-0 md:ml-12' : ''}
        `}
      >
        <AnimatePresence mode="wait">
          <PageTransition key={location}>
            {children}
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}
