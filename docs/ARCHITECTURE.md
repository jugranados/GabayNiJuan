# Architecture

## Decision

Use React Native + TypeScript + Expo.

## Why

- one codebase for Android and iOS
- good fit for the team's existing React Native experience
- lower setup friction for AI-assisted development
- Expo simplifies builds, updates, routing, assets, and platform configuration
- modern React Native defaults to TypeScript
- supports the New Architecture

## Recommended client stack

### Core
- React Native
- TypeScript (strict)
- Expo
- Expo Router

### Data
- `@supabase/supabase-js`
- TanStack Query for server state
- Zod for runtime validation

### Local state
- Zustand only for lightweight local/UI state
- avoid duplicating server data in Zustand

### Forms
- React Hook Form
- Zod resolver

### Testing
- Jest
- React Native Testing Library
- domain/model unit tests
- mapper/validation tests

## Backend

### Recommended initial backend: Supabase

Use:
- Postgres
- Row Level Security
- Auth for internal reviewers/admins
- Storage where appropriate
- Edge Functions only for server-only operations

Why Postgres fits this product:

Political data is relational and historical. A person can have many:
- election participations
- office terms
- affiliations
- sources
- claims
- case records
- disclosures
- relationships

Relational constraints and joins are useful here.

## Client architecture

Use feature-first organization:

```text
src/
  app/
  components/
  features/
    politicians/
    elections/
    offices/
    sources/
    legal-cases/
    disclosures/
    affiliations/
  domain/
    models/
    enums/
    validation/
  data/
    supabase/
    repositories/
    mappers/
  shared/
    hooks/
    utils/
    config/
    types/
```

## Data flow

```text
Supabase Row
   ↓
Zod validation
   ↓
Data mapper
   ↓
Domain model
   ↓
Repository
   ↓
Query/use-case hook
   ↓
View model / UI model
   ↓
Screen
```

UI code should never assume an unvalidated backend payload is correct.

## Backend access model

### Public mobile users
Read only data that has been published.

### Reviewers
Can create/edit draft records.

### Approvers
Can mark records as verified/published.

### Admin
Manages user roles and exceptional corrections.

The mobile app must never contain privileged backend credentials.

## Hosting

A mobile app itself does not require traditional web hosting.

For early stages:
- Supabase hosts database/API/auth/storage.
- Expo/EAS handles development and mobile build services.
- GitHub hosts source code.
- Optional public project/privacy pages can use GitHub Pages or Cloudflare Pages.

## Architecture decision to revisit later

If the app reaches substantial traffic or requires complex ingestion pipelines:
- introduce a dedicated backend/service layer
- background ingestion workers
- dedicated search service
- cached read models

Do not build these prematurely.
