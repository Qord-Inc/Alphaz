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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function syncUser() {
      if (!isLoaded || !isSignedIn || !clerkUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Check if user exists in our database
        const response = await fetch(`${API_BASE_URL}/api/users/${clerkUser.id}`, {
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
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
          } else {
            throw new Error('Failed to create user');
          }
        } else {
          throw new Error('Failed to fetch user');
        }
      } catch (err) {
        console.error('Error syncing user:', err);
        setError(err instanceof Error ? err.message : 'Failed to sync user');
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