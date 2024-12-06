import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import MemorizationSettings from './MemorizationSettings';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { theme } = useSettings();
  const settingsRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close settings
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings]);

  return (
    <div className={`fixed left-0 top-0 h-full z-50 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-48'}`}>
      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute right-0 top-4 translate-x-full ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}
      >
        {isOpen ? '←' : '→'}
      </Button>

      {/* Sidebar content */}
      <div className={`h-full w-48 p-4 shadow-lg ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <div className="space-y-4">
          <Link href="/">
            <Button
              variant="ghost"
              className="w-full justify-start"
            >
              🏠 Home
            </Button>
          </Link>

          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowTools(!showTools)}
            >
              🛠️ Tools {showTools ? '▼' : '▶'}
            </Button>
            {showTools && (
              <div className="pl-4 space-y-2">
                <Link href="/flashcards">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                  >
                    📝 Flashcards
                  </Button>
                </Link>
                <Link href="/memorization">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                  >
                    🧠 Memorization
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div 
            className="space-y-2" 
            ref={settingsRef}
          >
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowSettings(!showSettings)}
              onMouseEnter={() => !showSettings && setShowSettings(true)}
            >
              ⚙️ Settings {showSettings ? '▼' : '▶'}
            </Button>
            {showSettings && (
              <div 
                className="absolute left-48 top-0 mt-4"
              >
                <MemorizationSettings />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
