# Splitwise Clone (Next.js + Firebase)

A client-side rendered Splitwise-style expense splitting app built with Next.js App Router, Firebase Auth + Firestore, and a deterministic ledger engine for balances and settlement recommendations. The UI is fully CSR-friendly and ready to deploy on Vercel.

## Features
- Google sign-in (Firebase Auth) and auth-aware routing guard.
- Groups with share-code onboarding, soft-delete member management, and offline-friendly caching.
- Expense ledger model with multi-payer contributions, equal/exact/percentage/share splits, per-user adjustments, and deterministic rounding.
- Real-time balances, “who owes who” simplification, and settlement recording via Firestore listeners.
- Payments, editing, and soft deletion for both expenses and payments.
- Local IndexedDB cache + mutation queue keeps data usable offline and syncs when the browser reconnects.
- Type-safe calculation engine with unit tests covering complex scenarios.

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Firebase setup
1. Create a Firebase project and enable **Authentication → Google** provider.
2. Create a **Firestore** database in production mode.
3. Under Project settings → General → Web Apps, add a new web app and copy the config values.
4. Create a `.env.local` file based on `.env.example` and fill in the Firebase config values:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```
5. Upload the Firestore security rules from `firestore.rules` via the Firebase console or CLI.

### 3. Run locally
```bash
npm run dev
```
Visit `http://localhost:3000`, sign in with Google, and start creating groups.

### 4. Tests
Ledger logic is covered by Vitest. Run:
```bash
npm test
```

### 5. Deploy to Vercel
1. Push this repo to GitHub.
2. In Vercel, import the repo and select the **Next.js** framework (default settings work).
3. Add the same Firebase env vars to the Vercel project settings.
4. Deploy — no custom build steps are required beyond `npm install && npm run build`.

## Firestore Security Rules
Rules live in `firestore.rules` and enforce:
- Only authenticated users can access data.
- Users must be members of a group to read/write its data.
- Expense and payment writes validate positive amounts, matching currency, and member participation.

Apply them with the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

## Project Structure
```
app/                # Next.js App Router pages (CSR components)
components/         # Shared UI (AuthProvider, TopNav, ExpenseForm)
hooks/              # Reusable hooks (auth, groups, group detail)
lib/                # Firebase client, Firestore helpers, ledger calculations
types/              # TypeScript interfaces for all models
tests/              # Vitest specs for ledger logic
```

## Test Plan & Scenarios
- **Auth & onboarding**: Sign in with Google, create a group, invite via share code.
- **Single payer equal split**: Add a $120 dinner paid by one person and split equally — expect 80/‑40/‑40 balances (covered by tests).
- **Multi-payer custom split (₹10,000 example)**: Two people pay ₹3,000 and ₹7,000 for a ₹10,000 bill but should owe ₹5,000 each — verify the ledger shows ±₹2,000 balances and suggested settlement resolves it.
- **Multi-payer equal split**: Enter consecutive expenses paid by different people; balances should aggregate correctly.
- **Three+ participants with percentages**: Use percentage split for a 500 unit cost (20/40/40) and ensure settlement suggestions pay the creditor.
- **Shares/adjustments**: Assign different share counts and add adjustment lines; validate totals within the form and resulting balances.
- **Rounding edge case**: Use amounts like 33.33/33.33/33.34 and ensure overall balance remains deterministic (unit test provided).
- **Payments**: Record a settle-up payment and confirm it lowers the debtor’s balance while raising the creditor’s.
- **Soft deletes**: Delete an expense/payment and verify it disappears from UI and balances recompute.
- **Offline queue**: Go offline via DevTools, add an expense/payment, then reconnect and confirm it syncs to Firestore and disappears from the pending list.

## Notes
- All pages are marked as client components to keep rendering CSR-only.
- Ledger calculations (`lib/calculations.ts`) power the UI summaries and the Vitest suite ensures accuracy.
- The Firestore helpers manage realtime sync while `lib/localDb.ts` keeps a local cache so the app keeps working offline.

## Offline mode
- The app mirrors groups, members, expenses, and payments into IndexedDB (via `lib/localDb.ts`).
- Mutations performed offline are written to the local cache immediately and appended to a pending queue.
- When the browser fires the `online` event, the queue replays in order; Firestore listeners refresh the cache afterward.
- You don’t need to refresh: the UI reads from the cache when offline and quietly rehydrates when back online.
