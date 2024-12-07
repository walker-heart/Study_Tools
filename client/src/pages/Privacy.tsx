import { useSettings } from "@/contexts/SettingsContext";
import { Card } from "@/components/ui/card";

export default function Privacy() {
  const { theme } = useSettings();

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold text-center mb-8">Privacy Policy</h1>
      
      <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <div className="prose dark:prose-invert max-w-none">
          <h2>Introduction</h2>
          <p>This Privacy Policy describes how your personal information is collected, used, and shared when you use our flashcard study tools application.</p>
          
          <h2>Information We Collect</h2>
          <p>When you use our application, we collect information that you provide directly to us:</p>
          <ul>
            <li>Account information (email address when you sign in with Google)</li>
            <li>Study data (flashcards and study progress)</li>
            <li>Usage information (how you interact with our application)</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process and complete transactions</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
          </ul>

          <h2>Information Sharing</h2>
          <p>We do not share your personal information with third parties except:</p>
          <ul>
            <li>With your consent</li>
            <li>To comply with laws</li>
            <li>To protect our rights and property</li>
          </ul>

          <h2>Data Security</h2>
          <p>We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.</p>

          <h2>Changes to This Policy</h2>
          <p>We may update this privacy policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons.</p>

          <h2>Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us.</p>
        </div>
      </Card>
    </div>
  );
}
