# Sidebar LinkedIn Integration & Organization Switcher

## Overview

The sidebar now includes LinkedIn connection functionality and prepares for future organization (company page) switching.

## Features

### 1. LinkedIn Connect Button
- **Location**: Below navigation menu items
- **Visibility**: Only shows when user is not connected
- **Behavior**: 
  - Clicking initiates OAuth flow
  - Shows loading state during connection
  - Disappears once LinkedIn is connected

### 2. Profile Display
- **Connected State**:
  - Shows LinkedIn profile picture and name
  - Dropdown arrow for future account switching
  - "Personal" label underneath name

- **Disconnected State**:
  - Shows "Alphaz" branding
  - Connect LinkedIn button visible

### 3. Organization Switcher (Prepared for Future)
- **Dropdown Menu**:
  - Personal Profile (currently active)
  - Company Pages (disabled - "Coming soon")
  - Click outside to close
  - Visual selection indicator

### Implementation Details

#### State Management
```typescript
const [selectedProfile, setSelectedProfile] = useState<'personal' | 'company'>('personal')
const [showDropdown, setShowDropdown] = useState(false)
```

#### LinkedIn Connection Flow
1. User clicks "Connect LinkedIn" in sidebar
2. Redirected to LinkedIn OAuth
3. After authorization, profile info saved
4. Sidebar updates to show profile
5. Connect button hidden

#### Dropdown Behavior
- Click profile area to toggle dropdown
- Click outside to close
- Selection persists in state (ready for API integration)

### Future Enhancements

When company page API access is available:
1. Fetch user's company pages after LinkedIn connection
2. Enable company page option in dropdown
3. Store selected context in user preferences
4. Update API calls based on selected profile type
5. Show company logo/name when company selected

### UI/UX Considerations

- **Collapsed State**: Only shows profile picture
- **Expanded State**: Full profile info and dropdown
- **Responsive**: Text truncates on long names
- **Accessible**: Keyboard navigation ready
- **Visual Feedback**: Hover states and transitions

### Testing Checklist

- [ ] LinkedIn connect button appears when not connected
- [ ] OAuth flow completes successfully
- [ ] Profile picture and name display correctly
- [ ] Dropdown opens/closes on click
- [ ] Click outside closes dropdown
- [ ] Selection state persists
- [ ] Collapsed sidebar shows only picture
- [ ] Loading states work properly

### Migration from Dashboard

The LinkedIn connection functionality has been moved from the dashboard to the sidebar for better accessibility and context switching. Users can now:
1. Connect LinkedIn without leaving their current page
2. See their connection status at all times
3. Prepare for quick profile/company switching

### Code Structure

- **Sidebar Component**: Main logic for display and interaction
- **useUser Hook**: Provides LinkedIn profile data
- **LinkedIn Controller**: Handles OAuth and profile data
- **Database**: Stores profile info and future company pages