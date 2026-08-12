# ride-native admin

Admin dashboard for ride-native. Connects to the **same Supabase project**
as the mobile app — no separate backend. Meant to be deployed on its own
subdomain (e.g. `admin.amorlinnovations.co.za`), separate from the main
marketing site.

## What's built so far

- Login (username + password, same accounts as the mobile app)
- Access gate — only accounts with `is_admin = true` can get past login
- **Dashboard**: live counts (active rides, scheduled rides, completed
  today), revenue (today/week/month), community size (riders/drivers,
  verified drivers), and a "needs attention" section (pending driver
  verifications, open SOS alerts, support conversations awaiting a reply)
- **Documents**: the full driver document review queue (all 8 required
  document types), filterable by status, with an image preview (via a
  short-lived signed URL, not a public one) and Approve / Reject
  (with a reason shown back to the driver)
- **Promotions**: create/deactivate/delete promo codes for riders,
  drivers, or both — fixed-amount or percentage discounts, optional
  redemption cap and expiry
- **Admins**: see current admins, look up a user by exact username and
  grant them admin access, or revoke an existing admin (you can't revoke
  your own access — that's enforced server-side too, not just hidden in
  the UI)
- **Support**: every conversation, sorted so ones awaiting a reply float
  to the top, with a live thread view and reply box — replying here is
  exactly what shows up in the rider/driver app's own support chat
- **Drivers / Riders**: searchable directories with a real moderation
  action — Suspend (with a reason, shown back to the person) / Unsuspend.
  Suspension is enforced in the database itself (a suspended driver can't
  accept rides, a suspended rider can't request one) and the mobile app
  signs a suspended user straight back out, with the reason, the moment it
  notices — whether that's right after login or on reopening the app with
  an existing session
- **Content**: edit Terms & Conditions, Privacy Policy, and any future
  in-app copy — changes go live immediately, no app store update needed.
  The mobile app fetches this at render time (it used to be hardcoded
  placeholder text with dead links)
- **Admins**: two ways to grant admin access —
  - grant it to an existing rider/driver account by exact username
  - **or** create a brand-new account from scratch (email + password you
    set), for staff who've never used the rider/driver app at all
  Either way, you can also revoke access (not your own — that's blocked
  server-side, not just hidden in the UI)
- **Rides**: browse all rides, filterable by rider/driver
- **Ratings**: flagged-driver review queue — drivers with 5+ ratings and
  a sub-4.0 average are auto-flagged (see `20260808120000_driver_ratings.sql`).
  Drill into a driver to see their full rating history (stars, comment,
  which rider left it) and clear the flag once reviewed. Also searchable
  across all rated drivers, not just flagged ones.
- **Wallets**: searchable rider/driver wallet directory, balance and
  transaction history, manual credit/debit adjustments
- **Payouts**: review driver payout requests (amount + R5 fee deducted
  from their wallet on request) — Approve or Reject (refunds the driver)
  a pending request, then Mark Paid once you've sent the money via EFT
  using the bank details shown on the request
- **Payments**: card verification and ride card-reservation monitoring
- **Driver Subscriptions**: review and manage driver subscription status
- **Test Mode**: toggle test-mode access for specific driver accounts
- **SOS**: live safety alert queue with the actual message that was
  sent and how many emergency contacts were notified per alert
  (`View message sent`), backed by `20260812150000_admin_sos_alert_detail.sql`
- **Pricing**: configure ride pricing
- **Announcements**: broadcast in-app announcements

Everything above is routed and wired to Supabase — nothing in the
sidebar is placeholder/"Soon" at this point.

## Setup

```bash
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from
# Supabase Dashboard -> Project Settings -> API
npm run dev
```

Requires running the SQL migrations in the mobile app's
`supabase/migrations/` folder first, in order — run all of them with
`supabase db push`. The **Payouts** screen specifically needs
`20260812120000_driver_payout_requests.sql` and
`20260812130000_admin_list_payout_requests.sql` applied. The **Ratings**
screen needs `20260808120000_driver_ratings.sql` (adds the columns/trigger
logic) and `20260812140000_admin_driver_ratings_review.sql` (adds the
admin read/clear-flag RPCs) applied.

**Also deploy the second Edge Function** for creating brand-new admin
accounts (email + password, no prior app signup):

```bash
supabase functions deploy admin-create-account
```

No extra secrets needed for this one — `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are automatically available to every Edge
Function in your project. This is the only place in the whole admin
dashboard that touches the service role key, and it never leaves the
server — the browser only ever calls the function by name.

## Making your first admin

The Admins screen can grant access to anyone — but it only works for
someone who's *already* an admin to use it. The very first admin has to be
set directly in the Supabase SQL editor, once.

**Important:** a plain `UPDATE` won't work here. Migration
`0016_lockdown_profile_security.sql` adds a trigger that silently reverts
any change to `is_admin` unless it's authorized for that transaction —
this is what stops a regular user from granting themselves admin access
with a raw client call, but it also blocks a naive `UPDATE` run directly
in the SQL editor, with no error shown (it just quietly resets `is_admin`
back to `false`). Run both lines together, in one execution, so they
share a transaction:

```sql
select set_config('app.allow_admin_change', 'true', true);
update public.profiles set is_admin = true where username = 'your-username';
```

Text matching is case-sensitive, so if that doesn't seem to work, confirm
the exact stored username first:

```sql
select id, username, is_admin from public.profiles where username ilike 'your-username';
```

After that first admin exists, you don't need the SQL editor again — that
account can grant admin access to anyone else directly from the **Admins**
screen itself, which already goes through the proper gated path.

## Security notes

- Uses the **anon key**, never the service role key. Access control is
  enforced by Postgres Row Level Security + the `is_admin` flag, the same
  way the mobile app's admin-only RPCs work — not by anything in this
  frontend. Never add the service role key to this project or any `.env`
  that ships to the browser.
- The dashboard stats page calls one aggregate RPC
  (`get_admin_dashboard_stats`) rather than querying `profiles`/`rides`
  directly, so this screen never has row-level access to rider/driver PII
  (names, phone numbers, exact locations) — it only ever receives
  pre-computed counts and totals. Screens that genuinely need row-level
  data (e.g. a future document-review queue) will get their own narrowly
  scoped RLS policies/RPCs when built, rather than opening broad table
  access up front.

## Deployment

Static Vite build — deploy anywhere that serves a SPA (Vercel, Netlify,
Cloudflare Pages, or a plain static host behind your subdomain):

```bash
npm run build
# outputs to dist/
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment
variables on whatever host you use — same values as your local `.env`.

## Stack

Vite + React + TypeScript + Tailwind + `@supabase/supabase-js` +
`react-router-dom`. No Next.js — this is a pure client-side SPA, which is
enough for an internal tool like this and keeps deployment to a static
host simple.

`@supabase/supabase-js` is pinned to an exact version (`2.109.0`) rather
than a caret range — versions from `2.110.0` onward require Node 22+.
2.109.0 only needs Node 20+, which covers most current setups. If you
upgrade Node to 22 later, feel free to loosen this back to a caret range.
