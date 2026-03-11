

## Password Show/Hide Toggle Feature

### Changes Required

**1. LoginPage (`src/pages/LoginPage.tsx`)**
- Add `Eye` and `EyeOff` imports from lucide-react
- Add `showPassword` state with `useState(false)`
- Wrap password Input in a relative container
- Add toggle button positioned absolute right with:
  - Eye icon (closed when hidden, open when visible)
  - `aria-label` for accessibility ("Show password" / "Hide password")
  - Smooth hover transition
- Change Input type dynamically: `type={showPassword ? "text" : "password"}`

**2. RegisterPage (`src/pages/RegisterPage.tsx`)**
- Same changes as LoginPage for the password field
- Add `Eye` and `EyeOff` imports
- Add `showPassword` state
- Implement identical toggle UI pattern

### Implementation Details

**Toggle Button Styling:**
```tsx
<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-md"
  aria-label={showPassword ? "Hide password" : "Show password"}
>
  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
</button>
```

**Input Container:**
- Wrapper: `relative mt-1`
- Input: `pr-10` (padding-right for icon space)
- Default state: `type="password"` (hidden)

### Accessibility
- `aria-label` dynamically updates based on state
- Button is keyboard accessible
- Icon changes provide visual feedback

### Mobile/Responsive
- Toggle button maintains 44x44px touch target
- No responsive breakpoints needed - single design works across all devices

