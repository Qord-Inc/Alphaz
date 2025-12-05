"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Linkedin, Loader2, CheckCircle, XCircle, Building2, AlertCircle } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface LinkedInStatus {
  connected: boolean;
  profileUrl?: string;
  tokenExpired: boolean;
}

interface CompanyPage {
  id: string;
  company_id: string;
  company_name: string;
  company_vanity_name?: string;
  company_logo_url?: string;
}

export function LinkedInConnect() {
  const { user } = useUser();
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [companyPages, setCompanyPages] = useState<CompanyPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchLinkedInStatus();
    }
  }, [user]);

  useEffect(() => {
    // Check for OAuth callback parameters
    const params = new URLSearchParams(window.location.search);
    const linkedinStatus = params.get('linkedin');
    const error = params.get('error');

    if (linkedinStatus === 'connected') {
      // Refresh status after successful connection
      fetchLinkedInStatus();
      setErrorMessage(null);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      console.error('LinkedIn connection error:', error);
      
      // Set user-friendly error messages
      const errorMessages: Record<string, string> = {
        'linkedin_auth_failed': 'LinkedIn authorization was denied or failed. Please try again.',
        'missing_params': 'Invalid request parameters. Please try connecting again.',
        'invalid_state': 'Security validation failed. Please try connecting again.',
        'token_exchange_failed': 'Failed to complete LinkedIn authentication. Please check your app configuration.',
        'update_failed': 'Failed to save LinkedIn connection. Please try again.',
        'linkedin_callback_failed': 'An unexpected error occurred. Please try again.'
      };
      
      setErrorMessage(errorMessages[error] || decodeURIComponent(error));
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchLinkedInStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/status/${user?.id}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);

        // If connected, fetch company pages
        if (data.connected) {
          fetchCompanyPages();
        }
      }
    } catch (error) {
      console.error('Error fetching LinkedIn status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyPages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/company-pages/${user?.id}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCompanyPages(data.companyPages || []);
      }
    } catch (error) {
      console.error('Error fetching company pages:', error);
    }
  };

  const handleConnect = async () => {
    if (!user) return;
    
    setConnecting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/linkedin/url?clerkUserId=${user.id}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const { authUrl } = await response.json();
        // Redirect to LinkedIn OAuth
        window.location.href = authUrl;
      } else {
        console.error('Failed to get LinkedIn auth URL');
      }
    } catch (error) {
      console.error('Error connecting to LinkedIn:', error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user || !confirm('Are you sure you want to disconnect your LinkedIn account?')) return;

    setDisconnecting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/disconnect/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setStatus({ connected: false, tokenExpired: false });
        setCompanyPages([]);
      } else {
        console.error('Failed to disconnect LinkedIn');
      }
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">Connection Error</p>
              <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        </Card>
      )}
      
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Linkedin className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">LinkedIn Connection</h3>
              <p className="text-sm text-gray-500">
                {status?.connected 
                  ? "Your LinkedIn account is connected"
                  : "Connect your LinkedIn account to manage posts and analytics"
                }
              </p>
              {status?.tokenExpired && (
                <p className="text-sm text-orange-500 mt-1">
                  Your connection has expired. Please reconnect.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {status?.connected && !status?.tokenExpired ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-red-600 hover:text-red-700"
                >
                  {disconnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Disconnect"
                  )}
                </Button>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-gray-400" />
                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Linkedin className="w-4 h-4 mr-2" />
                  )}
                  Connect LinkedIn
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {status?.connected && companyPages.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Connected Company Pages
          </h3>
          <div className="space-y-3">
            {companyPages.map((page) => (
              <div 
                key={page.id} 
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                {page.company_logo_url && (
                  <img
                    src={page.company_logo_url}
                    alt={page.company_name}
                    className="w-10 h-10 rounded"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium">{page.company_name}</p>
                  {page.company_vanity_name && (
                    <p className="text-sm text-gray-500">
                      linkedin.com/company/{page.company_vanity_name}
                    </p>
                  )}
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}