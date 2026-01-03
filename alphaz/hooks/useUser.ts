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

// Cache TTL for user data - 24 hours (user data rarely changes during session)
const USER_CACHE_TTL = 24 * 60 * 60 * 1000;

// Helper to get valid cached user data
function getValidCachedUser(): User | null {
  try {
    const cached = localStorage.getItem('user-data');
    if (cached) {
      const { data, timestamp, clerkId } = JSON.parse(cached);
      // Cache must have data, clerkId, and not be expired
      if (data && clerkId && Date.now() - timestamp < USER_CACHE_TTL) {
        return data;
      }
    }
  } catch {}
  return null;
}

export function useUser() {
  const { isLoaded, isSignedIn, user: clerkUser } = useClerkUser();
  
  // Try to load cached user data immediately (will be validated in useEffect)
  const [user, setUser] = useState<User | null>(() => getValidCachedUser());
  
  // If we have cached data, we're not truly "loading"
  const [loading, setLoading] = useState(() => getValidCachedUser() === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function syncUser() {
      if (!isLoaded || !isSignedIn || !clerkUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Check if we have valid cached data - skip API call if so
      try {
        const cached = localStorage.getItem('user-data');
        if (cached) {
          const { data, timestamp, clerkId } = JSON.parse(cached);
          const isValidCache = clerkId === clerkUser.id && 
                               Date.now() - timestamp < USER_CACHE_TTL && 
                               data;
          
          if (isValidCache) {
            console.log('📦 Using cached user data (valid cache)', { linkedin_connected: data.linkedin_connected });
            setUser(data);
            setLoading(false);
            return; // Don't fetch if we have valid cache
          } else {
            // Cache is invalid (wrong user, expired, or missing clerkId) - clear it
            console.log('🗑️ Clearing invalid user cache', { 
              hasClerkId: !!clerkId, 
              sameUser: clerkId === clerkUser.id,
              expired: Date.now() - timestamp >= USER_CACHE_TTL 
            });
            localStorage.removeItem('user-data');
          }
        }
      } catch (e) {
        console.warn('Error reading user cache:', e);
        localStorage.removeItem('user-data');
      }

      console.log('🔄 Fetching user data from API');
      try {
        // Fetch with timeout (50 seconds) - increased to handle slow backend responses
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 50000);

        const response = await fetch(`${API_BASE_URL}/api/users/${clerkUser.id}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          console.log('✅ API returned user data:', { 
            linkedin_connected: data.user?.linkedin_connected,
            linkedin_profile_name: data.user?.linkedin_profile_name 
          });
          setUser(data.user);
          
          // Cache the user data with clerk ID for validation
          try {
            localStorage.setItem('user-data', JSON.stringify({
              data: data.user,
              timestamp: Date.now(),
              clerkId: clerkUser.id
            }));
            console.log('💾 User data cached successfully');
          } catch (cacheError) {
            console.warn('Failed to cache user data:', cacheError);
          }
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
            
            // Cache the new user data with clerk ID
            try {
              localStorage.setItem('user-data', JSON.stringify({
                data: data.user,
                timestamp: Date.now(),
                clerkId: clerkUser.id
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