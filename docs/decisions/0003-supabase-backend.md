# 0003 — Supabase for accounts, data, files and server code

**Context.** Accounts with cloud sync, document storage, and somewhere to keep third-party API keys
out of the app. Budget: $0. Kart Racer already used Supabase.

**Decision.** Supabase free tier: Postgres with row-level security per user, Auth (email + password
without email confirmation; Google OAuth), Storage for originals and photos, and Edge Functions as
the only place that calls Gemini, Ticketmaster, Photon, Unsplash and the flight-status API.
Migrations and deploys go through the Management API with a personal access token, because cloud
sessions can only reach HTTPS (no direct Postgres connection).

**Consequences.**
- One service and one set of secrets; keys never ship in the bundle.
- Free projects pause after about a week idle, so a GitHub Action keeps the database alive.
- Free limits (500 MB database, 1 GB storage) are ample for the demo.
