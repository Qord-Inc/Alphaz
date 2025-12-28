"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

interface Organization {
  id: string
  name: string
  role: string
  vanityName?: string
  logoUrl?: string
}

interface OrganizationContextType {
  selectedOrganization: Organization | null
  setSelectedOrganization: (org: Organization | null) => void
  isPersonalProfile: boolean
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem('selected-organization')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Save to localStorage whenever selection changes
  useEffect(() => {
    try {
      if (selectedOrganization) {
        localStorage.setItem('selected-organization', JSON.stringify(selectedOrganization))
      } else {
        localStorage.removeItem('selected-organization')
      }
    } catch (error) {
      console.error('Failed to save organization selection:', error)
    }
  }, [selectedOrganization])

  const isPersonalProfile = selectedOrganization === null

  return (
    <OrganizationContext.Provider value={{ 
      selectedOrganization, 
      setSelectedOrganization,
      isPersonalProfile 
    }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}