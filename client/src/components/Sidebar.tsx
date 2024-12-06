import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const { theme } = useSettings();

  return (
    <div className={`fixed left-0 top-0 h-full z-50 transition-all duration-200 ease-in-out ${isOpen ? 'translate-x-0 shadow-lg' : '-translate-x-40'}`}>
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute right-0 top-4 translate-x-full rounded-l-none border-l-0 ${theme === 'dark' ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white hover:bg-gray-100'}`}
      >
        {isOpen ? '←' : '→'}
      </Button>

      {/* Sidebar content */}
      <div className={`h-full w-48 p-4 shadow-xl border-r ${theme === 'dark' ? 'bg-gray-800 text-white border-gray-700' : 'bg-white border-gray-200'}`}>
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
