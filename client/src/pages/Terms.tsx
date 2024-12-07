import { useSettings } from "@/contexts/SettingsContext";
import { Card } from "@/components/ui/card";

export default function Terms() {
  const { theme } = useSettings();

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold text-center mb-8">Terms of Service</h1>
      
      <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <div className="prose dark:prose-invert max-w-none">
          <h2>Terms of Use</h2>
          <p>By accessing and using this flashcard study tools application, you accept and agree to be bound by the terms and provision of this agreement.</p>

          <h2>Use License</h2>
          <p>Permission is granted to temporarily use this application for personal, non-commercial study purposes only.</p>

          <h2>User Account</h2>
          <p>To access certain features of the application, you may be required to sign in using Google authentication. You are responsible for maintaining the confidentiality of your account.</p>

          <h2>Acceptable Use</h2>
          <ul>
            <li>Create and study flashcards for educational purposes</li>
            <li>Share study materials within the platform's intended functionality</li>
            <li>Use the application in compliance with all applicable laws</li>
          </ul>

          <h2>Prohibited Activities</h2>
          <ul>
            <li>Use the application for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any portion of the application</li>
            <li>Upload malicious content or interfere with the application's functionality</li>
          </ul>

          <h2>Intellectual Property</h2>
          <p>The application and its original content, features, and functionality are owned by the application providers and are protected by international copyright, trademark, and other intellectual property laws.</p>

          <h2>Termination</h2>
          <p>We may terminate or suspend your access to the application immediately, without prior notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties, or for any other reason.</p>

          <h2>Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. We will notify users of any changes by updating the date at the top of this agreement.</p>

          <h2>Contact Information</h2>
          <p>If you have any questions about these Terms, please contact us.</p>
        </div>
      </Card>
    </div>
  );
}
