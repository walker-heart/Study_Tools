import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, Link, Router as WouterRouter } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { SettingsProvider } from "./contexts/SettingsContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Flashcards from "./pages/Flashcards";
import Memorization from "./pages/Memorization";
import MemorizationEasy from "./pages/MemorizationEasy";
import MemorizationMedium from "./pages/MemorizationMedium";
import Settings from "./pages/Settings";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/dashboard">
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        </Route>
        <Route path="/flashcards">
          <ProtectedRoute>
            <Flashcards />
          </ProtectedRoute>
        </Route>
        <Route path="/memorization">
          <ProtectedRoute>
            <Memorization />
          </ProtectedRoute>
        </Route>
        <Route path="/memorization-easy">
          <ProtectedRoute>
            <MemorizationEasy />
          </ProtectedRoute>
        </Route>
        <Route path="/memorization-medium">
          <ProtectedRoute>
            <MemorizationMedium />
          </ProtectedRoute>
        </Route>
        <Route path="/settings">
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        </Route>
        <Route path="/signin" component={SignIn} />
        <Route path="/signup" component={SignUp} />
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
    </Layout>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <WouterRouter>
          <Router />
        </WouterRouter>
        <Toaster />
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
