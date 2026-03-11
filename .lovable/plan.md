

## Plan: Replace Favicon with User's Uploaded Logo

The `index.html` already references `/favicon.png`, but the file at `public/favicon.png` is still the old AI-generated logo. Need to overwrite it with the user's uploaded image (`user-uploads://image-9.png`).

### Steps
1. Copy `user-uploads://image-9.png` to `public/favicon.png`, overwriting the existing file
2. No HTML changes needed — `index.html` already points to `/favicon.png`

