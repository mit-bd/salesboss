

## Plan: Add Copyright Footer + Improvements

### 1. Copyright Footer in AppLayout
Add a footer inside the main content area (after children) showing:
**"© 2026 Motion IT BD. All rights reserved."**
Styled subtly in `text-muted-foreground text-xs`, centered, with top border.

### 2. Copyright on Auth Pages
Add the same copyright text to LoginPage, RegisterPage, ForgotPasswordPage, and ResetPasswordPage at the bottom.

### 3. Files to Modify
- `src/components/layout/AppLayout.tsx` — add footer after content div
- `src/pages/LoginPage.tsx` — add footer at bottom
- `src/pages/RegisterPage.tsx` — add footer at bottom
- `src/pages/ForgotPasswordPage.tsx` — add footer at bottom
- `src/pages/ResetPasswordPage.tsx` — add footer at bottom

