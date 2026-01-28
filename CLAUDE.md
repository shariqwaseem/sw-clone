# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start Next.js dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint check
npm test         # Run Vitest tests (runs all tests in tests/)
npx vitest run tests/calculations.test.ts  # Run a single test file
```

## Architecture Overview

This is a Splitwise-style expense splitting app using Next.js 14 App Router (CSR-only) with Firebase Auth/Firestore backend and offline-first capabilities.

### Data Flow

1. **Firebase layer** (`lib/firebase.ts`, `lib/firestore.ts`) - Firestore real-time subscriptions and CRUD operations
2. **Local cache** (`lib/localDb.ts`) - localStorage-based cache for offline reads
3. **Offline queue** (`lib/offlineQueue.ts`) - Queued mutations that replay when back online
4. **Hooks** (`hooks/`) - React hooks that orchestrate cache-first reads with Firestore sync

When offline, mutations write to local cache immediately and queue for later sync. The `useOfflineSync` hook triggers `flushPendingMutations()` on reconnect.

### Ledger Calculation Engine

`lib/calculations.ts` contains the deterministic balance logic:
- `computeExpenseDeltas()` - Calculates per-user balance changes for a single expense
- `computeGroupNetBalances()` - Aggregates all expenses and payments into net balances
- `simplifySettlements()` - Reduces balances to minimum number of transfers
- `roundCurrency()` - Consistent 2-decimal rounding to avoid floating point issues

The `validateExpense()` function ensures payer totals and split totals match the expense total.

### Key Data Types (`types/index.ts`)

- `Expense` - Multi-payer, multi-split expense with `payers: PayerLine[]` and `splits: SplitLine[]`
- `Payment` - Settlement between two users (`fromUid` pays `toUid`)
- `GroupMember` - User within a group with role and soft-delete status
- Soft deletes use `isDeleted` flag; balances exclude deleted items

### Split Modes in ExpenseForm

The `ExpenseForm` component supports four split modes: equal, exact, percentage, and shares. Each mode computes splits differently and supports per-user adjustments.

## Firebase Configuration

Requires `.env.local` with Firebase config (see `.env.example`). Security rules in `firestore.rules` enforce member-based access control.
