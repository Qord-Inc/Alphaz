"use client";

import { LinkedInGateProvider } from "@/components/linkedin-gate";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <LinkedInGateProvider>
      {children}
    </LinkedInGateProvider>
  );
}
