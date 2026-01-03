"use client";

import { useUser } from "@/hooks/useUser";
import { useUser as useClerkUser } from "@clerk/nextjs";
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { Linkedin, Loader2, Lock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ============================================
// Context for LinkedIn Gate
// ============================================
interface LinkedInGateContextType {
  isLinkedInConnected: boolean;
  isLoading: boolean;
  showConnectModal: () => void;
  requireLinkedIn: (callback: () => void) => void;
}

const LinkedInGateContext = createContext<LinkedInGateContextType | null>(null);

export function useLinkedInGate() {
  const context = useContext(LinkedInGateContext);
  if (!context) {
    throw new Error("useLinkedInGate must be used within a LinkedInGateProvider");
  }
  return context;
}

// ============================================
// Provider Component
// ============================================
interface LinkedInGateProviderProps {
  children: React.ReactNode;
}

export function LinkedInGateProvider({ children }: LinkedInGateProviderProps) {
  const { user, loading } = useUser();
  const { user: clerkUser } = useClerkUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  const isLinkedInConnected = !!user?.linkedin_connected;

  // Handle LinkedIn OAuth callback - clear cache to force refresh
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedinStatus = params.get('linkedin');
    
    if (linkedinStatus === 'connected') {
      // Clear user cache to force re-fetch with updated LinkedIn status
      localStorage.removeItem('user-data');
      // Clean up URL and reload to get fresh data
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    }
  }, []);

  const showConnectModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const hideConnectModal = useCallback(() => {
    setIsModalOpen(false);
    setPendingCallback(null);
  }, []);

  // Function to wrap any action that requires LinkedIn
  const requireLinkedIn = useCallback((callback: () => void) => {
    if (isLinkedInConnected) {
      callback();
    } else {
      setPendingCallback(() => callback);
      setIsModalOpen(true);
    }
  }, [isLinkedInConnected]);

  const handleConnect = async () => {
    if (!clerkUser) return;
    
    setConnecting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/linkedin/url?clerkUserId=${clerkUser.id}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const { authUrl } = await response.json();
        window.location.href = authUrl;
      } else {
        console.error('Failed to get LinkedIn auth URL');
        setConnecting(false);
      }
    } catch (error) {
      console.error('Error connecting to LinkedIn:', error);
      setConnecting(false);
    }
  };

  return (
    <LinkedInGateContext.Provider value={{ 
      isLinkedInConnected, 
      isLoading: loading, 
      showConnectModal,
      requireLinkedIn 
    }}>
      {children}
      
      {/* LinkedIn Connect Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={hideConnectModal}
          />
          
          {/* Modal */}
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-background rounded-2xl shadow-2xl border border-border max-w-md w-full p-8 animate-in fade-in-0 zoom-in-95 duration-300 pointer-events-auto relative">
              {/* Close button */}
              <button
                onClick={hideConnectModal}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>

              {/* Lock icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Linkedin className="w-10 h-10 text-blue-600" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center border-2 border-background">
                    <Lock className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
              </div>

              {/* Title and description */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  Connect Your LinkedIn
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  To use this feature, please connect your LinkedIn account first.
                </p>
              </div>

              {/* Features list */}
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Personalized content creation tailored to your voice</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Quick check-in calls with Alphaz to brainstorm post ideas</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Track performance with detailed analytics</span>
                </div>
              </div>

              {/* Connect button */}
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full h-12 text-base font-semibold bg-[#0077B5] hover:bg-[#006097] text-white"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Linkedin className="w-5 h-5 mr-2" />
                    Connect LinkedIn
                  </>
                )}
              </Button>

              {/* Privacy note */}
              <p className="text-xs text-center text-muted-foreground mt-4">
                We only request necessary permissions. Your data is secure and private.
              </p>
            </div>
          </div>
        </div>
      )}
    </LinkedInGateContext.Provider>
  );
}

// ============================================
// HOC for wrapping buttons/CTAs
// ============================================
interface LinkedInRequiredButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onAction: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function LinkedInRequiredButton({ 
  onAction, 
  children, 
  className,
  disabled,
  variant,
  size,
  ...props 
}: LinkedInRequiredButtonProps) {
  const { requireLinkedIn } = useLinkedInGate();

  const handleClick = () => {
    requireLinkedIn(onAction);
  };

  return (
    <Button 
      onClick={handleClick} 
      className={className} 
      disabled={disabled}
      variant={variant}
      size={size}
      {...props}
    >
      {children}
    </Button>
  );
}
