# 🎨 Dark/Light Theme System

## Overview
Complete dark/light theme implementation for Alphaz with smooth transitions, persistent storage, and system preference detection.

## Features Implemented

### ✅ Core Theme System
- **ThemeContext**: React context for global theme management
- **ThemeToggle**: Animated toggle component with sun/moon icons
- **Persistent Storage**: Theme preference saved to localStorage
- **System Preference**: Automatically detects OS dark mode preference
- **No Flash**: Prevents FOUC (Flash of Unstyled Content) on page load

### ✅ Components Updated for Dark Mode
1. **Create Page** (`app/create/page.tsx`)
   - Chat messages with theme-aware colors
   - Floating input box with dark mode support
   - Header and blocked state UI
   - Landing page heading
   - Chat info panel

2. **Draft Panel** (`components/draft-panel.tsx`)
   - Container and borders
   - Collapsed state indicators
   - Header and draft selector thumbnails
   - All interactive elements

3. **LinkedIn Post Preview** (`components/linkedin-post-preview.tsx`)
   - Card background and borders
   - Organization avatar
   - Post content area
   - Action buttons with hover states

4. **Sidebar** (`components/sidebar.tsx`)
   - Theme toggle added above user profile
   - Positioned in both collapsed and expanded states

### ✅ CSS Variables
Enhanced dark mode color palette in `app/globals.css`:
- Rich dark backgrounds with warm undertones
- Elevated card surfaces
- Orange primary accent theme
- Vibrant chart colors
- Proper border and input colors

## Usage

### Theme Toggle Component
```tsx
import { ThemeToggle } from '@/components/theme-toggle';

// In your component
<ThemeToggle />
```

### Using Theme in Code
```tsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { theme, toggleTheme, setTheme } = useTheme();
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('light')}>Light</button>
    </div>
  );
}
```

### Using Tailwind Dark Mode Classes
```tsx
// Example: Different colors for light/dark mode
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>

// Using CSS variables (recommended)
<div className="bg-card text-foreground border-border">
  Content
</div>
```

## Design Tokens

### Light Mode
- Background: Warm offwhite (rgba(241, 236, 233, 1))
- Card: Pure white
- Text: Dark gray
- Borders: Light gray

### Dark Mode
- Background: Rich dark with warm undertones (oklch(0.15 0.01 30))
- Card: Elevated dark surface (oklch(0.18 0.01 30))
- Text: Near white
- Borders: Subtle dark borders
- Accent: Orange gradient

## CSS Variables Reference

### Common Variables
- `--background`: Page background
- `--foreground`: Primary text color
- `--card`: Card background
- `--card-foreground`: Card text color
- `--border`: Border color
- `--muted`: Muted background
- `--muted-foreground`: Muted text color
- `--primary`: Primary accent color
- `--accent`: Accent background for hover states

### Tailwind Usage
```css
bg-background    /* Page background */
text-foreground  /* Primary text */
bg-card          /* Card surface */
border-border    /* Borders */
bg-muted         /* Muted areas */
text-muted-foreground /* Secondary text */
```

## Files Created/Modified

### New Files
- ✅ `contexts/ThemeContext.tsx` - Theme state management
- ✅ `components/theme-toggle.tsx` - Toggle button component
- ✅ `THEME_SYSTEM.md` - This documentation

### Modified Files
- ✅ `app/layout.tsx` - Added ThemeProvider wrapper + FOUC prevention
- ✅ `app/globals.css` - Enhanced dark mode CSS variables
- ✅ `app/create/page.tsx` - All UI elements updated for dark mode
- ✅ `components/sidebar.tsx` - Added theme toggle
- ✅ `components/draft-panel.tsx` - Dark mode support
- ✅ `components/linkedin-post-preview.tsx` - Dark mode support

## Testing Checklist

- [ ] Theme toggle works in sidebar (both collapsed and expanded)
- [ ] Theme persists across page reloads
- [ ] System preference is detected on first visit
- [ ] No flash of wrong theme on page load
- [ ] All text is readable in both modes
- [ ] All borders are visible in both modes
- [ ] Buttons have proper hover states in both modes
- [ ] Draft panel looks good in both modes
- [ ] LinkedIn preview looks good in both modes
- [ ] Chat messages are readable in both modes
- [ ] Floating input box looks good in both modes

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ All modern browsers with CSS custom properties support

## Performance

- Theme switch is instant (CSS variables)
- No re-render of entire app (only ThemeContext consumers)
- Theme detection runs before React hydration (no flash)
- localStorage read is synchronous and fast

## Future Enhancements

- [ ] Add theme transition animations (fade between themes)
- [ ] Add more color scheme options (high contrast, etc.)
- [ ] Add per-component theme overrides
- [ ] Add theme preview in settings
- [ ] Add scheduled theme switching (day/night)

## Troubleshooting

### Theme not persisting
- Check localStorage is enabled in browser
- Check console for errors
- Verify ThemeProvider is wrapping app

### Flash of wrong theme
- Verify inline script in layout.tsx is present
- Check `suppressHydrationWarning` is on `<html>` tag

### Colors not updating
- Ensure using Tailwind dark mode classes or CSS variables
- Check component is using `dark:` prefix correctly
- Verify `@custom-variant dark (&:is(.dark *));` in globals.css

## Resources

- [Tailwind Dark Mode Docs](https://tailwindcss.com/docs/dark-mode)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
