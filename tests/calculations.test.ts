import { describe, expect, it } from 'vitest';
import { computeExpenseDeltas, computeGroupNetBalances, simplifySettlements } from '../lib/calculations';
import type { Expense, GroupMember, Payment } from '../types';

const baseMembers: GroupMember[] = [
  { uid: 'u1', email: 'u1@example.com', displayName: 'U1', joinedAt: Date.now(), role: 'member', status: 'active' },
  { uid: 'u2', email: 'u2@example.com', displayName: 'U2', joinedAt: Date.now(), role: 'member', status: 'active' },
  { uid: 'u3', email: 'u3@example.com', displayName: 'U3', joinedAt: Date.now(), role: 'member', status: 'active' }
];

let counter = 0;
const mockExpense = (overrides: Partial<Expense>): Expense => ({
  id: overrides.id ?? `expense-${counter++}`,
  description: overrides.description ?? 'Test',
  totalAmount: overrides.totalAmount ?? 0,
  currency: overrides.currency ?? 'USD',
  date: overrides.date ?? new Date().toISOString(),
  payers: overrides.payers ?? [],
  splits: overrides.splits ?? [],
  createdBy: overrides.createdBy ?? 'u1',
  createdAt: overrides.createdAt ?? Date.now(),
  updatedAt: overrides.updatedAt ?? Date.now(),
  notes: overrides.notes,
  isDeleted: overrides.isDeleted
});

describe('computeExpenseDeltas', () => {
  it('handles single payer equal split', () => {
    const expense = mockExpense({
      totalAmount: 120,
      payers: [{ uid: 'u1', amount: 120 }],
      splits: [
        { uid: 'u1', amount: 40 },
        { uid: 'u2', amount: 40 },
        { uid: 'u3', amount: 40 }
      ]
    });
    const deltas = computeExpenseDeltas(expense);
    expect(deltas).toEqual({ u1: 80, u2: -40, u3: -40 });
  });

  it('handles multi payer custom split', () => {
    const expense = mockExpense({
      totalAmount: 10000,
      payers: [
        { uid: 'u1', amount: 3000 },
        { uid: 'u2', amount: 7000 }
      ],
      splits: [
        { uid: 'u1', amount: 5000 },
        { uid: 'u2', amount: 5000 }
      ]
    });
    const deltas = computeExpenseDeltas(expense);
    expect(deltas).toEqual({ u1: -2000, u2: 2000 });
  });
});

describe('group balances and settlements', () => {
  it('computes balances for multi payer equal split', () => {
    const expenses: Expense[] = [
      mockExpense({
        totalAmount: 90,
        payers: [{ uid: 'u1', amount: 90 }],
        splits: [
          { uid: 'u1', amount: 30 },
          { uid: 'u2', amount: 30 },
          { uid: 'u3', amount: 30 }
        ]
      }),
      mockExpense({
        totalAmount: 60,
        payers: [{ uid: 'u2', amount: 60 }],
        splits: [
          { uid: 'u1', amount: 20 },
          { uid: 'u2', amount: 20 },
          { uid: 'u3', amount: 20 }
        ]
      })
    ];

    const balances = computeGroupNetBalances(expenses, [], baseMembers);
    expect(balances.u1).toBeCloseTo(70);
    expect(balances.u2).toBeCloseTo(10);
    expect(balances.u3).toBeCloseTo(-80);
  });

  it('supports 3+ people with percentages', () => {
    const expenses: Expense[] = [
      mockExpense({
        totalAmount: 500,
        payers: [{ uid: 'u1', amount: 500 }],
        splits: [
          { uid: 'u1', amount: 100 },
          { uid: 'u2', amount: 200 },
          { uid: 'u3', amount: 200 }
        ]
      })
    ];
    const balances = computeGroupNetBalances(expenses, [], baseMembers);
    expect(balances).toEqual({ u1: 400, u2: -200, u3: -200 });
    const settlements = simplifySettlements(balances);
    expect(settlements).toHaveLength(2);
    expect(settlements.some(s => s.fromUid === 'u2' && s.toUid === 'u1' && s.amount === 200)).toBe(true);
  });

  it('adjusts for rounding edge', () => {
    const expenses: Expense[] = [
      mockExpense({
        totalAmount: 100,
        payers: [{ uid: 'u1', amount: 100 }],
        splits: [
          { uid: 'u1', amount: 33.34 },
          { uid: 'u2', amount: 33.33 },
          { uid: 'u3', amount: 33.33 }
        ]
      })
    ];
    const balances = computeGroupNetBalances(expenses, [], baseMembers);
    expect(balances.u1).toBeCloseTo(66.66, 2);
    expect(balances.u2).toBeCloseTo(-33.33, 2);
    expect(balances.u3).toBeCloseTo(-33.33, 2);
  });

  it('includes payments impact', () => {
    const expenses: Expense[] = [
      mockExpense({
        totalAmount: 120,
        payers: [{ uid: 'u1', amount: 120 }],
        splits: [
          { uid: 'u1', amount: 40 },
          { uid: 'u2', amount: 40 },
          { uid: 'u3', amount: 40 }
        ]
      })
    ];

    const payments: Payment[] = [
      {
        id: 'p1',
        fromUid: 'u3',
        toUid: 'u1',
        amount: 20,
        date: new Date().toISOString(),
        createdBy: 'u3',
        createdAt: Date.now(),
        note: ''
      }
    ];

    const balances = computeGroupNetBalances(expenses, payments, baseMembers);
    expect(balances.u3).toBeCloseTo(-20);
    expect(balances.u1).toBeCloseTo(60);
  });
});
