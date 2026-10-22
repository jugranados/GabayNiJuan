# Free-Tier Infrastructure Plan

## Mobile

React Native + Expo.

Expo provides a free tier with limited build/update capacity suitable for early development.

## Database/API/Auth

Supabase Free.

Current free-tier limits should always be checked before launch, but it is suitable for an MVP and includes a Postgres database, authentication, storage, realtime, and edge-function quotas.

## Why Supabase over current Firebase Realtime Database

The deciding factor is not simply price.

Gabay ni Juan needs:
- relational history
- many-to-many evidence
- foreign keys
- auditable revisions
- flexible filtering
- structured joins
- reviewer/admin policies

Postgres is a more natural fit.

## File storage

Use Supabase Storage initially for:
- app-owned assets
- permitted public documents
- thumbnails

Whenever possible, source evidence should retain the authoritative external URL/document identifier rather than blindly copying third-party files.

## Web hosting

Not required for the mobile application.

Optional public pages:
- GitHub Pages
- Cloudflare Pages

Possible future admin dashboard:
- Cloudflare Pages
- Vercel
- Netlify
- Supabase-backed static/web client

Choose only when the admin workflow is implemented.

## Cost controls

- no paid infrastructure in Phase 0
- no service requiring a credit card unless necessary
- add usage monitoring before public launch
- avoid large document duplication
- resize/compress images
- paginate lists
- cache read-heavy stable data
