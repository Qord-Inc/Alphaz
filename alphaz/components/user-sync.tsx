"use client";

import { useUser } from "@/hooks/useUser";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function UserSync({ children }: { children: React.ReactNode }) {
  const { user, loading, error, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If user is signed in but no user data exists, they might be in the sign-up flow
    if (isSignedIn && !loading && !user && !error) {
      console.log('User signed in but no database record found');
    }

    // If there's an error syncing user data, log it but don't block the UI
    if (error) {
      console.error('Error syncing user:', error);
    }
  }, [isSignedIn, loading, user, error]);

  // Show loading state only on initial load
  if (loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // Render children regardless of sync status
  return <>{children}</>;
}