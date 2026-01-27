import type { Expense, GroupMember, Payment, Settlement } from '@/types';

const EPSILON = 0.01;

export function roundCurrency(value: number, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor + Number.EPSILON) / factor;
}

export function computeExpenseDeltas(expense: Expense) {
  if (expense.isDeleted) return {} as Record<string, number>;
  const deltas: Record<string, number> = {};

  for (const payer of expense.payers) {
    deltas[payer.uid] = roundCurrency((deltas[payer.uid] ?? 0) + payer.amount);
  }

  for (const split of expense.splits) {
    deltas[split.uid] = roundCurrency((deltas[split.uid] ?? 0) - split.amount);
  }

  return deltas;
}

export function computeGroupNetBalances(
  expenses: Expense[],
  payments: Payment[],
  members: GroupMember[]
) {
  const balances: Record<string, number> = members.reduce((acc, member) => {
    acc[member.uid] = 0;
    return acc;
  }, {} as Record<string, number>);

  for (const expense of expenses) {
    const deltas = computeExpenseDeltas(expense);
    for (const [uid, delta] of Object.entries(deltas)) {
      balances[uid] = roundCurrency((balances[uid] ?? 0) + delta);
    }
  }

  for (const payment of payments) {
    if (payment.isDeleted) continue;
    balances[payment.fromUid] = roundCurrency((balances[payment.fromUid] ?? 0) + payment.amount);
    balances[payment.toUid] = roundCurrency((balances[payment.toUid] ?? 0) - payment.amount);
  }

  return balances;
}

export function simplifySettlements(balances: Record<string, number>): Settlement[] {
  const creditors: { uid: string; amount: number }[] = [];
  const debtors: { uid: string; amount: number }[] = [];

  for (const [uid, amount] of Object.entries(balances)) {
    const rounded = roundCurrency(amount);
    if (rounded > EPSILON) {
      creditors.push({ uid, amount: rounded });
    } else if (rounded < -EPSILON) {
      debtors.push({ uid, amount: -rounded });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > EPSILON) {
      settlements.push({
        fromUid: debtor.uid,
        toUid: creditor.uid,
        amount: roundCurrency(amount)
      });
    }

    debtor.amount = roundCurrency(debtor.amount - amount);
    creditor.amount = roundCurrency(creditor.amount - amount);

    if (debtor.amount <= EPSILON) i += 1;
    if (creditor.amount <= EPSILON) j += 1;
  }

  return settlements;
}

export function validateExpense(expense: Expense) {
  if (expense.totalAmount <= 0) {
    throw new Error('Total amount must be positive');
  }
  const totalPaid = roundCurrency(expense.payers.reduce((sum, p) => sum + p.amount, 0));
  const totalOwed = roundCurrency(expense.splits.reduce((sum, s) => sum + s.amount, 0));

  if (Math.abs(totalPaid - expense.totalAmount) > EPSILON) {
    throw new Error('Sum of payer amounts must match total');
  }
  if (Math.abs(totalOwed - expense.totalAmount) > EPSILON) {
    throw new Error('Sum of split amounts must match total');
  }
  for (const line of [...expense.payers, ...expense.splits]) {
    if (line.amount < 0) {
      throw new Error('Amounts must be non-negative');
    }
  }
}
