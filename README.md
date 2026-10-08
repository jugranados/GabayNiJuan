# Gabay ni Juan

Gabay ni Juan is a neutral, evidence-first voter information platform for the Philippines.

Its purpose is to help voters understand the documented public record of political figures and election participants without endorsing, ranking, or telling users who to vote for.

## Product principles

1. Every material political claim must be traceable to evidence.
2. Primary sources are preferred over secondary reporting.
3. Allegations, charges, pending cases, dismissals, acquittals, convictions, and final judgments must never be collapsed into one label.
4. The app must separate facts, self-declared positions, reporting, analysis, and unresolved claims.
5. Candidate/election status must be time-aware.
6. Corrections must be visible and auditable.
7. The product must remain politically neutral.
8. No politician score, trust score, endorsement, ranking, or "best candidate" feature.

## Stack

- React Native + TypeScript (strict), Expo SDK 57, Expo Router
- TanStack Query for server state
- Zustand for lightweight local UI state
- Zod for runtime validation
- Supabase: Postgres, Auth for reviewers/admins, Storage where legally appropriate, Edge Functions only when needed
- React Hook Form + Zod resolver, added when the first form ships ("Report an error")
- Jest + React Native Testing Library

See `docs/` and `AGENTS.md` before implementing features.

## Repository layout

| Path | Contents |
|---|---|
| `mobile/` | React Native / Expo app (Android + iOS) |
| `docs/` | Product, data model, governance, and architecture decisions |
| `.github/workflows/` | CI (typecheck, lint, test, expo-doctor) |

The original native Android (Kotlin/Compose) prototype is kept on the `develop` branch (`origin/develop`). It is a historical reference and is not part of this branch.

## Development setup

### Requirements

- Node.js 20.19.4+, 22.13+, or 24.3+ (`.nvmrc` pins 24). npm comes with Node.
- To run on a device: the **Expo Go** app (Android/iOS), or
- Android Studio with an emulator for `npm run android`, and/or
- Xcode with an iOS Simulator on macOS for `npm run ios`.

### Install and run

```bash
cd mobile
npm install
cp .env.example .env.local   # optional; defaults to fictional mock data
npm start                    # Expo dev server; scan the QR code with Expo Go
npm run android              # open on an Android emulator/device
npm run ios                  # open on the iOS Simulator (macOS only)
```

### Environment

Configuration is read from `EXPO_PUBLIC_*` variables in `mobile/.env.local`, which is git-ignored. See `mobile/.env.example`.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_DATA_SOURCE` | `mock` (default, fictional fixtures) or `supabase` |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (required for `supabase`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key only (required for `supabase`) |

`EXPO_PUBLIC_*` values are bundled into the app and are public. **Never** put the Supabase service-role key or any `sb_secret_` key in the app. The app refuses to start if it detects one.

### Quality checks

```bash
cd mobile
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # ESLint (expo config) + Prettier check
npm test            # Jest + React Native Testing Library
npm run verify      # all three
npm run lint:fix    # auto-fix lint and formatting
```
