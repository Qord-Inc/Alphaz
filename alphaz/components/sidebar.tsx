"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { UserButton, useUser as useClerkUser } from "@clerk/nextjs"
import { useUser } from "@/hooks/useUser"
import { useOrganization } from "@/contexts/OrganizationContext"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { 
  BarChart3, 
  PenTool, 
  TrendingUp, 
  Calendar,
  ChevronLeft,
  Building2,
  User,
  Loader2,
  Linkedin,
  ChevronDown,
  LogOut,
  PhoneCall,
  Sparkles
} from "lucide-react"

interface SidebarProps {
  className?: string
}

interface MenuItem {
  icon: any
  label: string
  href: string
  personalOnly?: boolean
}

const menuItems: MenuItem[] = [
  { icon: BarChart3, label: "Dashboard", href: "/dashboard" },
  { icon: PenTool, label: "Create", href: "/create" },
  { icon: TrendingUp, label: "Monitor", href: "/" },
  { icon: Calendar, label: "Plan", href: "/plan" },
  { icon: PhoneCall, label: "Check-in", href: "/check-in", personalOnly: true } as any,
  { icon: Sparkles, label: "Personalization", href: "/personalization", personalOnly: true } as any,
]

export function Sidebar({ className }: SidebarProps) {
  // Initialize state from localStorage to prevent flash
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed")
      return stored === "1"
    } catch {
      return false
    }
  })
  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0")
      } catch {}
      return next
    })
  }
  const pathname = usePathname()
  const { user, loading: userLoading } = useUser()
  const { user: clerkUser } = useClerkUser()
  const { selectedOrganization, setSelectedOrganization } = useOrganization()
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<'personal' | 'company'>('personal')
  const [connectingLinkedIn, setConnectingLinkedIn] = useState(false)
  const [disconnectingLinkedIn, setDisconnectingLinkedIn] = useState(false)
  const [companyPages, setCompanyPages] = useState<any[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleConnectLinkedIn = async () => {
    if (!clerkUser) return
    
    setConnectingLinkedIn(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/linkedin/url?clerkUserId=${clerkUser.id}`)
      const data = await response.json()
      
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (error) {
      console.error('Error connecting to LinkedIn:', error)
      setConnectingLinkedIn(false)
    }
  }

  const handleDisconnectLinkedIn = async () => {
    if (!clerkUser) return
    
    setDisconnectingLinkedIn(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/linkedin/disconnect/${clerkUser.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Refresh the page to update the user state
        window.location.reload()
      } else {
        console.error('Failed to disconnect LinkedIn')
      }
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error)
    } finally {
      setDisconnectingLinkedIn(false)
    }
  }

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fetch company pages when LinkedIn is connected
  useEffect(() => {
    const fetchCompanyPages = async () => {
      if (user?.linkedin_connected && user?.clerk_user_id) {
        console.log('Fetching company pages for user:', user.clerk_user_id)
        
        // Try to load cached company pages immediately
        try {
          const cached = localStorage.getItem(`company-pages-${user.clerk_user_id}`);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            // Use cache if less than 10 minutes old
            if (Date.now() - timestamp < 10 * 60 * 1000) {
              console.log('Using cached company pages');
              setCompanyPages(data);
            }
          }
        } catch {}
        
        // Fetch fresh data in background
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/linkedin/company-pages/${user.clerk_user_id}`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Company pages response:', data);
            const pages = data.companyPages || [];
            setCompanyPages(pages);
            
            // Cache the company pages
            try {
              localStorage.setItem(`company-pages-${user.clerk_user_id}`, JSON.stringify({
                data: pages,
                timestamp: Date.now()
              }));
            } catch {}
          } else {
            console.error('Failed to fetch company pages:', response.status, response.statusText);
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.warn('Company pages request timed out, using cached data');
          } else {
            console.error('Error fetching company pages:', error);
          }
        }
      }
    }

    fetchCompanyPages()
  }, [user?.linkedin_connected, user?.clerk_user_id])

  // Sync sidebar state with organization context on mount
  useEffect(() => {
    if (selectedOrganization) {
      setSelectedProfile('company')
      setSelectedCompanyId(selectedOrganization.id)
    } else {
      setSelectedProfile('personal')
      setSelectedCompanyId(null)
    }
  }, [])

  return (
    <div
      className={cn(
        "relative flex h-screen flex-col border-r bg-black text-white transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-800">
        {!isCollapsed && (
          <div className="flex items-center space-x-3 flex-1">
            {userLoading ? (
              <div className="flex items-center space-x-2 flex-1">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-800 rounded animate-pulse mb-1" />
                  <div className="h-3 bg-gray-800 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ) : user?.linkedin_connected ? (
              <div className="relative flex-1" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-3 hover:bg-gray-800 p-1 rounded transition-colors w-full"
                >
                  {selectedProfile === 'personal' ? (
                    user.linkedin_profile_picture_url ? (
                      <img 
                        src={user.linkedin_profile_picture_url} 
                        alt={user.linkedin_profile_name || "Profile"}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#0077b5] flex items-center justify-center flex-shrink-0">
                        <Linkedin className="w-4 h-4 text-white" />
                      </div>
                    )
                  ) : (
                    (() => {
                      const selectedCompany = companyPages.find((c: any) => c.id === selectedCompanyId)
                      return selectedCompany?.logoUrl ? (
                        <img 
                          src={selectedCompany.logoUrl} 
                          alt={selectedCompany.name || "Company"}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-gray-400" />
                        </div>
                      )
                    })()
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {selectedProfile === 'personal' ? 
                        user.linkedin_profile_name : 
                        (companyPages.find((c: any) => c.id === selectedCompanyId)?.name || 'Select Company')
                      }
                    </div>
                    <div className="text-xs text-gray-400">
                      {selectedProfile === 'personal' ? 'Personal' : 'Company Page'}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
                
                {/* Dropdown menu */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-lg z-50 max-h-96 overflow-y-auto">
                    {/* Loading state for company pages */}
                    {companyPages.length === 0 && user?.linkedin_connected && (
                      <div className="p-4 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto mb-2" />
                        <div className="text-xs text-gray-400">Loading organizations...</div>
                      </div>
                    )}
                    {/* Personal Profile Option */}
                    <button
                      onClick={() => {
                        setSelectedProfile('personal')
                        setSelectedCompanyId(null)
                        setSelectedOrganization(null)
                        setShowDropdown(false)
                      }}
                      className={cn(
                        "flex items-center space-x-3 w-full p-3 hover:bg-gray-800 transition-colors",
                        selectedProfile === 'personal' && "bg-gray-800"
                      )}
                    >
                      {user.linkedin_profile_picture_url ? (
                        <img 
                          src={user.linkedin_profile_picture_url} 
                          alt={user.linkedin_profile_name || "Profile"}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 p-1.5 text-gray-400 bg-gray-800 rounded-full" />
                      )}
                      <div className="text-left flex-1">
                        <div className="text-sm text-white font-medium">{user.linkedin_profile_name || 'Personal Profile'}</div>
                        <div className="text-xs text-gray-400">Personal Account</div>
                      </div>
                      {selectedProfile === 'personal' && (
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      )}
                    </button>
                    
                    {/* Divider if there are company pages */}
                    {companyPages.length > 0 && (
                      <div className="border-t border-gray-700 my-1" />
                    )}
                    
                    {/* Company Pages Section - Only show when pages are loaded */}
                    {companyPages.length > 0 && user?.linkedin_connected && (
                      <>
                        <div className="px-3 py-2 text-xs text-gray-500 font-medium uppercase tracking-wider">
                          Company Pages
                        </div>
                        {companyPages.map((company: any) => (
                          <button
                            key={company.id}
                            onClick={() => {
                              setSelectedProfile('company')
                              setSelectedCompanyId(company.id)
                              setSelectedOrganization({
                                id: company.id,
                                name: company.name,
                                role: company.role || 'ADMINISTRATOR',
                                vanityName: company.vanityName
                              })
                              setShowDropdown(false)
                            }}
                            className={cn(
                              "flex items-center space-x-3 w-full p-3 hover:bg-gray-800 transition-colors",
                              selectedProfile === 'company' && selectedCompanyId === company.id && "bg-gray-800"
                            )}
                          >
                            {company.logoUrl ? (
                              <img src={company.logoUrl} alt={company.name} className="w-8 h-8 rounded object-cover" />
                            ) : (
                              <Building2 className="w-8 h-8 p-1.5 text-gray-400 bg-gray-800 rounded" />
                            )}
                            <div className="text-left flex-1">
                              <div className="text-sm text-white font-medium">{company.name}</div>
                              <div className="text-xs text-gray-400">{company.vanityName || `ID: ${company.id}`}</div>
                            </div>
                            {selectedProfile === 'company' && selectedCompanyId === company.id && (
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                            )}
                          </button>
                        ))}</> 
                    )}
                    {/* Disconnect LinkedIn Button */}
                    <button
                      onClick={handleDisconnectLinkedIn}
                      disabled={disconnectingLinkedIn}
                      className="flex items-center space-x-3 w-full p-3 hover:bg-gray-800 transition-colors border-t border-gray-700 text-red-400 hover:text-red-300"
                    >
                      {disconnectingLinkedIn ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      <div className="text-sm">Disconnect LinkedIn</div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="font-semibold text-lg text-white">Alphaz</div>
            )}
          </div>
        )}
        {isCollapsed && (
          userLoading ? (
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : user?.linkedin_connected ? (
            user.linkedin_profile_picture_url ? (
              <img 
                src={user.linkedin_profile_picture_url} 
                alt={user.linkedin_profile_name || "Profile"}
                className="w-8 h-8 rounded-full object-cover mx-auto"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#0077b5] flex items-center justify-center mx-auto">
                <Linkedin className="w-4 h-4 text-white" />
              </div>
            )
          ) : null
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className={cn(
            "text-gray-300 hover:text-white hover:bg-gray-800",
            !isCollapsed && "ml-auto"
          )}
        >
          <ChevronLeft className={cn(
            "h-4 w-4 transition-transform",
            isCollapsed && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-2 px-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            const isDisabled = item.personalOnly && selectedProfile !== 'personal'
            return (
              <li key={item.label}>
                <Link href={isDisabled ? '#' : item.href} className="cursor-pointer">
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800 cursor-pointer",
                      isActive && "bg-white text-orange-500 hover:bg-white hover:text-orange-600",
                      isCollapsed && "justify-center px-2",
                      isDisabled && "opacity-50 pointer-events-none"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {!isCollapsed && <span className="ml-3">{item.label}</span>}
                  </Button>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* LinkedIn Connect Button or Loading State */}
      {userLoading ? (
        <div className="px-4 py-2 border-t border-gray-800">
          <div className={cn(
            "w-full h-10 rounded-md flex items-center justify-center bg-gray-800 animate-pulse",
            isCollapsed && "px-2"
          )}>
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            {!isCollapsed && <span className="ml-2 text-sm text-gray-400">Loading...</span>}
          </div>
        </div>
      ) : !user?.linkedin_connected ? (
        <div className="px-4 py-2 border-t border-gray-800">
          <Button
            onClick={handleConnectLinkedIn}
            disabled={connectingLinkedIn}
            className={cn(
              "w-full bg-[#0077b5] hover:bg-[#0066a2] text-white",
              isCollapsed && "px-2"
            )}
          >
            {connectingLinkedIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Linkedin className="w-4 h-4" />
                {!isCollapsed && <span className="ml-2">Connect LinkedIn</span>}
              </>
            )}
          </Button>
        </div>
      ) : null}

      {/* User Profile & Theme Toggle */}
      <div className="border-t border-gray-800">
        {/* Theme Toggle */}
        {!isCollapsed && (
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        )}
        
        {isCollapsed && (
          <div className="p-2 border-b border-gray-800 flex justify-center">
            <ThemeToggle />
          </div>
        )}

        {/* User Profile */}
        <div className="p-4">
          <div className="flex items-center space-x-3">
            <UserButton 
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                  userButtonTrigger: "focus:shadow-none",
                }
              }}
            />
            {!isCollapsed && clerkUser && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {clerkUser.fullName || clerkUser.emailAddresses?.[0]?.emailAddress || "User"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}