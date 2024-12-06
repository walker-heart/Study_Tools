import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const { theme } = useSettings();

  return (
    <div className={`fixed left-0 top-0 h-full z-50 transition-all duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-48'}`}>
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

          <Link href="/settings">
            <Button
              variant="ghost"
              className="w-full justify-start"
            >
              ⚙️ Settings
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
