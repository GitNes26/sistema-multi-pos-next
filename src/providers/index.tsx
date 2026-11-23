"use client";

import { QueryProvider } from "./query-provider";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { MobileProvider } from "./mobile-provider";
import { NoWheelNumber } from "./no-wheel-number";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <ThemeProvider>
          <MobileProvider>
            <NoWheelNumber />
            {children}
          </MobileProvider>
        </ThemeProvider>
      </QueryProvider>
    </AuthProvider>
  );
}