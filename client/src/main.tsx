import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, Link } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { SettingsProvider } from "./contexts/SettingsContext";
import Home from "./pages/Home";
import Flashcards from "./pages/Flashcards";
import Memorization from "./pages/Memorization";
import MemorizationEasy from "./pages/MemorizationEasy";
import MemorizationMedium from "./pages/MemorizationMedium";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/flashcards" component={Flashcards} />
      <Route path="/memorization" component={Memorization} />
      <Route path="/memorization-easy" component={MemorizationEasy} />
      <Route path="/memorization-medium" component={MemorizationMedium} />
      <Route>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
          <p className="mb-4">The page you're looking for doesn't exist.</p>
          <Link href="/">
            <a className="text-blue-500 hover:underline">Return to Home</a>
          </Link>
        </div>
      </Route>
    </Switch>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <Router />
        <Toaster />
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
