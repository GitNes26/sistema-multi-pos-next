"use client";

import { QueryProvider } from "./query-provider";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { MobileProvider } from "./mobile-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider>
          <MobileProvider>{children}</MobileProvider>
        </ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}