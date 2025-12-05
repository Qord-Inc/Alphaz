// Theme configuration for easy customization
export const theme = {
  colors: {
    background: {
      // App page background (orange + grey mix offwhite)
      app: "rgba(241, 236, 233, 1)",
      // Card surfaces remain pure white for contrast
      card: "#ffffff",
    },
    primary: {
      orange: "#ff6b35",
      blue: "#3b82f6",
      purple: "#8b5cf6",
      pink: "#ec4899",
      green: "#10b981",
      red: "#ef4444"
    },
    sidebar: {
      background: "hsl(var(--sidebar))",
      foreground: "hsl(var(--sidebar-foreground))",
      border: "hsl(var(--sidebar-border))"
    },
    metrics: {
      positive: "#10b981", // green
      negative: "#ef4444", // red
      neutral: "#6b7280"  // gray
    }
  },
  spacing: {
    sidebar: {
      collapsed: "4rem",  // 64px
      expanded: "16rem"   // 256px  
    }
  }
} as const

export type Theme = typeof theme