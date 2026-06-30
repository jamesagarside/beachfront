import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.tsx";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { getStoredToken } from "./auth/token.ts";
import { seedDemoCache } from "./demo/demo.ts";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

const queryClient = new QueryClient();

// With no token the app runs in demo mode (#27): prime the cache with the baked
// public snapshot so the token-less (disabled) queries resolve from it. A stored
// token means live fetch, so we leave the cache clean.
if (!getStoredToken()) seedDemoCache(queryClient);

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
