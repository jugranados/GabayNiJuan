# Gabay ni Juan — web

The primary application: the public voter site and the `/admin` boundary. Setup and commands are
in the repository `README.md`; decisions are in `docs/WEB_MIGRATION.md` and `docs/ARCHITECTURE.md`.

```bash
npm install
cp .env.example .env.local   # optional; defaults to fictional mock data
npm run dev                  # http://localhost:3000
npm run verify               # typecheck, lint, tests
```
