import React from "react"
import { theme } from "@/lib/theme"

// Design system components for consistent styling

export const DesignSystem = {
  Background: {
    app: theme.colors.background.app,
    card: theme.colors.background.card,
  },
  // Color variants for metrics and indicators
  MetricColor: {
    positive: "text-green-600",
    negative: "text-red-600", 
    neutral: "text-gray-600"
  },
  
  // Icon color variants
  IconColor: {
    blue: "text-blue-500",
    purple: "text-purple-500", 
    pink: "text-pink-500",
    green: "text-green-500",
    orange: "text-orange-500"
  },
  
  // Chart colors that match the design
  ChartColors: {
    primary: "#ff6b35",
    secondary: "#3b82f6",
    tertiary: "#8b5cf6"
  },
  
  // Spacing utilities
  Spacing: {
    sidebarCollapsed: theme.spacing.sidebar.collapsed,
    sidebarExpanded: theme.spacing.sidebar.expanded
  }
}

// Utility function to get consistent colors
export const getMetricColor = (type: "positive" | "negative" | "neutral") => {
  const colors = {
    positive: "text-green-600",
    negative: "text-red-600", 
    neutral: "text-gray-600"
  }
  return colors[type]
}

export const getIconColor = (variant: keyof typeof DesignSystem.IconColor) => {
  return DesignSystem.IconColor[variant]
}