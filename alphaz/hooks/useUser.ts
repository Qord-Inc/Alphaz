import { useUser as useClerkUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string;
  google_id?: string;
  auth_method: "gmail" | "email";
  subscription_status: "trial" | "free" | "pro" | "enterprise";
  linkedin_connected: boolean;
  linkedin_profile_name?: string;
  linkedin_profile_picture_url?: string;
  linkedin_profile_url?: string;
  trial_start_date: string;
  trial_end_date: string;
  created_at: string;
  updated_at: string;
}

export function useUser() {
  const { isLoaded, isSignedIn, user: clerkUser } = useClerkUser();
  const [user, setUser] = useState<User | null>(() => {
    // Try to load cached user data immediately
    try {
      const cached = localStorage.getItem('user-data');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return data;
        }
      }
    } catch {}
    return null;
  });
  // If we have cached data, we're not truly "loading", just refreshing in background
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('user-data');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return false; // We have valid cache, not loading
        }
      }
    } catch {}
    return true; // No cache, we're loading
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function syncUser() {
      if (!isLoaded || !isSignedIn || !clerkUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Fetch with timeout (10 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${API_BASE_URL}/api/users/${clerkUser.id}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          
          // Cache the user data
          try {
            localStorage.setItem('user-data', JSON.stringify({
              data: data.user,
              timestamp: Date.now()
            }));
          } catch {}
        } else if (response.status === 404) {
          // User doesn't exist, create them
          const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress;
          const googleAccount = clerkUser.externalAccounts?.find(
            account => account.provider === "google"
          );
          
          const createResponse = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clerkUserId: clerkUser.id,
              email: primaryEmail,
              name: clerkUser.fullName || clerkUser.firstName || primaryEmail?.split('@')[0] || 'User',
              googleId: googleAccount?.providerUserId,
              authMethod: googleAccount ? 'gmail' : 'email'
            })
          });

          if (createResponse.ok) {
            const data = await createResponse.json();
            setUser(data.user);
            
            // Cache the new user data
            try {
              localStorage.setItem('user-data', JSON.stringify({
                data: data.user,
                timestamp: Date.now()
              }));
            } catch {}
          } else {
            throw new Error('Failed to create user');
          }
        } else {
          throw new Error('Failed to fetch user');
        }
      } catch (err) {
        console.error('Error syncing user:', err);
        
        // If we have cached data and this is a timeout/network error, use the cache
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn('Request timed out, using cached data if available');
          // User state already set from cache in useState initializer
          if (!user) {
            setError('Connection timeout - please check your network');
          }
        } else {
          setError(err instanceof Error ? err.message : 'Failed to sync user');
        }
      } finally {
        setLoading(false);
      }
    }

    syncUser();
  }, [isLoaded, isSignedIn, clerkUser]);

  return {
    user,
    loading: loading || !isLoaded,
    error,
    isSignedIn
  };
}