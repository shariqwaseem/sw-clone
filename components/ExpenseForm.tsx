'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Expense, GroupMember } from '@/types';
import { v4 as uuid } from 'uuid';
import { createExpense, updateExpense } from '@/lib/firestore';
import { useAuthContext } from './AuthProvider';
import { roundCurrency, validateExpense } from '@/lib/calculations';

interface Props {
  groupId: string;
  members: GroupMember[];
  currency: string;
  expense?: Expense;
  onSaved?: () => void;
}

type SplitMode = 'equal' | 'exact' | 'percentage' | 'shares';

export function ExpenseForm({ groupId, members, currency, expense, onSaved }: Props) {
  const { user } = useAuthContext();
  const userId = user?.uid;
  const [description, setDescription] = useState(expense?.description ?? '');
  const [totalAmount, setTotalAmount] = useState(expense?.totalAmount ?? 0);
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString().substring(0, 10));
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    expense?.splits.map(split => split.uid) ?? members.map(m => m.uid)
  );
  const [splitValues, setSplitValues] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    expense?.splits.forEach(split => {
      map[split.uid] = split.amount;
    });
    return map;
  });
  const [percentageValues, setPercentageValues] = useState<Record<string, number>>({});
  const [shareValues, setShareValues] = useState<Record<string, number>>({});
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [adjustmentInputs, setAdjustmentInputs] = useState<Record<string, string>>({});
  const [payers, setPayers] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    expense?.payers.forEach(p => {
      map[p.uid] = p.amount;
    });
    return map;
  });
  const [payersTouched, setPayersTouched] = useState(false);
  const [status, setStatus] = useState('');
  const otherMembers = members.filter(member => member.uid !== userId);
  const firstOtherMember = otherMembers[0];
  const showQuickOptions = Boolean(userId && firstOtherMember && otherMembers.length === 1);
  const participantIds = selectedMembers.length ? selectedMembers : members.map(m => m.uid);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }),
    [currency]
  );

  const setAutoPayers = (next: Record<string, number>) => {
    setPayers(next);
    setPayersTouched(false);
  };

  useEffect(() => {
    if (!expense) return;
    setSplitMode('exact');
  }, [expense]);

  useEffect(() => {
    if (expense || members.length === 0) return;
    setSelectedMembers(prev => (prev.length === 0 ? members.map(member => member.uid) : prev));
  }, [expense, members]);

  useEffect(() => {
    if (expense || !userId || totalAmount <= 0) return;
    if (payersTouched) return;
    setAutoPayers({ [userId]: totalAmount });
  }, [expense, payersTouched, totalAmount, userId]);

  const computedSplits = useMemo(() => {
    const base: Record<string, number> = {};
    if (splitMode === 'exact') {
      participantIds.forEach(uid => {
        base[uid] = splitValues[uid] ?? 0;
      });
    } else if (splitMode === 'percentage') {
      participantIds.forEach(uid => {
        base[uid] = roundCurrency(totalAmount * ((percentageValues[uid] ?? 0) / 100));
      });
    } else if (splitMode === 'shares') {
      const totalShares = participantIds.reduce((sum, uid) => sum + (shareValues[uid] ?? 1), 0);
      participantIds.forEach(uid => {
        const weight = shareValues[uid] ?? 1;
        base[uid] = totalShares === 0 ? 0 : roundCurrency((totalAmount * weight) / totalShares);
      });
    } else {
      const equalAmount = participantIds.length ? roundCurrency(totalAmount / participantIds.length) : 0;
      participantIds.forEach(uid => {
        base[uid] = equalAmount;
      });
    }

    participantIds.forEach(uid => {
      base[uid] = roundCurrency((base[uid] ?? 0) + (adjustments[uid] ?? 0));
    });

    return base;
  }, [adjustments, participantIds, percentageValues, shareValues, splitMode, splitValues, totalAmount]);

  const payerTotal = useMemo(
    () =>
      Object.values(payers).reduce((sum, amount) => sum + (Number.isNaN(amount) ? 0 : Number(amount)), 0),
    [payers]
  );

  const splitTotal = useMemo(
    () => participantIds.reduce((sum, uid) => sum + (computedSplits[uid] ?? 0), 0),
    [computedSplits, participantIds]
  );

  const quickOption = useMemo(() => {
    if (!firstOtherMember || !showQuickOptions) return null;
    const equalAmount = participantIds.length ? roundCurrency(totalAmount / participantIds.length) : 0;
    const isEqualSplit = participantIds.every(uid => Math.abs((computedSplits[uid] ?? 0) - equalAmount) < 0.01);
    const payerEntries = Object.entries(payers).filter(([, amount]) => amount && amount > 0);
    if (
      splitMode === 'equal' &&
      payerEntries.length === 1 &&
      participantIds.length >= 2 &&
      isEqualSplit
    ) {
      const payerUid = payerEntries[0]?.[0];
      if (payerUid === userId) {
        return 'you-paid-equally';
      }
      if (payerUid === firstOtherMember?.uid) {
        return 'other-paid-equally';
      }
    }
    if (
      splitMode === 'exact' &&
      participantIds.length === 1 &&
      Math.abs((computedSplits[participantIds[0]] ?? 0) - totalAmount) < 0.01
    ) {
      const owedUid = participantIds[0];
      if (owedUid === firstOtherMember?.uid && payerEntries.length === 1 && payerEntries[0]?.[0] === userId) {
        return 'you-are-owed';
      }
      if (owedUid === userId && payerEntries.length === 1 && payerEntries[0]?.[0] === firstOtherMember?.uid) {
        return 'other-is-owed';
      }
    }
    return null;
  }, [computedSplits, firstOtherMember, participantIds, payers, showQuickOptions, splitMode, totalAmount, userId]);

  if (!user) {
    return null;
  }

  const toggleMember = (uid: string) => {
    setSelectedMembers(prev => (prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (totalAmount <= 0) {
      setStatus('Total amount must be greater than zero');
      return;
    }
    if (participantIds.length === 0) {
      setStatus('Select at least one participant');
      return;
    }

    const finalSplits = participantIds.map(uid => ({ uid, amount: roundCurrency(computedSplits[uid] ?? 0) }));
    const finalPayers = Object.entries(payers)
      .filter(([, amount]) => amount && amount > 0)
      .map(([uid, amount]) => ({ uid, amount: roundCurrency(amount) }));

    if (finalPayers.length === 0) {
      setStatus('Add at least one payer amount');
      return;
    }

    if (Math.abs(splitTotal - totalAmount) > 0.05) {
      setStatus('Split totals must equal the total amount');
      return;
    }
    if (Math.abs(payerTotal - totalAmount) > 0.05) {
      setStatus('Payer totals must equal the total amount');
      return;
    }

    const expenseId = expense?.id ?? uuid();
    const payload = {
      id: expenseId,
      description,
      totalAmount,
      currency,
      date,
      notes,
      payers: finalPayers,
      splits: finalSplits,
      createdBy: expense?.createdBy ?? user.uid,
      createdAt: expense?.createdAt ?? Date.now(),
      updatedAt: Date.now()
    } as Expense;

    try {
      validateExpense(payload);
    } catch (error) {
      setStatus((error as Error).message);
      return;
    }

    try {
      if (expense) {
        await updateExpense(
          groupId,
          expenseId,
          {
            description,
            totalAmount,
            date,
            notes,
            payers: finalPayers,
            splits: finalSplits
          },
          user
        );
      } else {
        await createExpense(
          groupId,
          payload,
          user
        );
      }
      setStatus('Saved!');
      onSaved?.();
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-slate-600">Description</span>
          <input
            value={description}
            onChange={event => setDescription(event.target.value)}
            className="input-base"
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-slate-600">Total amount</span>
          <input
            inputMode="decimal"
            value={totalAmount ? totalAmount.toString() : ''}
            onChange={event => setTotalAmount(event.target.value === '' ? 0 : parseFloat(event.target.value) || 0)}
            className="input-base"
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-slate-600">Date</span>
          <input
            type="date"
            value={date}
            onChange={event => setDate(event.target.value)}
            className="input-base"
          />
        </label>
        <label className="space-y-1">
          <span className="text-sm text-slate-600">Notes (optional)</span>
          <input
            value={notes}
            onChange={event => setNotes(event.target.value)}
            className="input-base"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        {showQuickOptions && firstOtherMember && (
          <div className="mb-5 rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">Quick options</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <QuickOptionButton
                active={quickOption === 'you-paid-equally'}
                title="You paid, split equally."
                description={`${firstOtherMember.displayName} owes you ${currencyFormatter.format(
                  participantIds.length > 0 ? roundCurrency(totalAmount / participantIds.length) : 0
                )}.`}
                onClick={() => {
                  if (!userId) return;
                  setSplitMode('equal');
                  setSelectedMembers(members.map(member => member.uid));
                  setAutoPayers({ [userId]: totalAmount });
                }}
              />
              <QuickOptionButton
                active={quickOption === 'other-paid-equally'}
                title={`${firstOtherMember.displayName} paid, split equally.`}
                description={`You owe ${currencyFormatter.format(
                  participantIds.length > 0 ? roundCurrency(totalAmount / participantIds.length) : 0
                )}.`}
                onClick={() => {
                  setSplitMode('equal');
                  setSelectedMembers(members.map(member => member.uid));
                  setAutoPayers({ [firstOtherMember.uid]: totalAmount });
                }}
              />
              <QuickOptionButton
                active={quickOption === 'other-is-owed'}
                title={`${firstOtherMember.displayName} is owed the full amount.`}
                description={`You owe ${currencyFormatter.format(totalAmount)}.`}
                onClick={() => {
                  setSplitMode('exact');
                  setSelectedMembers([user.uid]);
                  setSplitValues({ [user.uid]: totalAmount });
                  setAutoPayers({ [firstOtherMember.uid]: totalAmount });
                }}
              />
              <QuickOptionButton
                active={quickOption === 'you-are-owed'}
                title="You are owed the full amount."
                description={`${firstOtherMember.displayName} owes you ${currencyFormatter.format(totalAmount)}.`}
                onClick={() => {
                  if (!userId) return;
                  setSplitMode('exact');
                  setSelectedMembers([firstOtherMember.uid]);
                  setSplitValues({ [firstOtherMember.uid]: totalAmount });
                  setAutoPayers({ [userId]: totalAmount });
                }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Payers</h3>
          <span className="text-xs text-slate-500">Total: {payerTotal.toFixed(2)}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {members.map(member => (
            <label key={member.uid} className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-sm font-medium text-slate-700">{member.displayName}</span>
              <input
                inputMode="decimal"
                value={payers[member.uid]?.toString() ?? ''}
                onChange={event => {
                  setPayersTouched(true);
                  setPayers(prev => ({
                    ...prev,
                    [member.uid]: event.target.value === '' ? 0 : parseFloat(event.target.value) || 0
                  }));
                }}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-right text-sm transition-colors hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-semibold">Split between</h3>
          <select
            value={splitMode}
            onChange={event => setSplitMode(event.target.value as SplitMode)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-colors hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
          >
            <option value="equal">Equally</option>
            <option value="exact">Exact amounts</option>
            <option value="percentage">Percentages</option>
            <option value="shares">Shares</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {members.map(member => (
            <button
              type="button"
              key={member.uid}
              onClick={() => toggleMember(member.uid)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                participantIds.includes(member.uid)
                  ? 'border-brand bg-blue-50 text-brand'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {member.displayName}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {participantIds.map(uid => (
            <div key={uid} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="font-medium text-sm">{members.find(m => m.uid === uid)?.displayName ?? uid}</p>
              {splitMode === 'exact' && (
                <input
                  inputMode="decimal"
                  value={splitValues[uid]?.toString() ?? ''}
                  onChange={event =>
                    setSplitValues(prev => ({
                      ...prev,
                      [uid]: event.target.value === '' ? 0 : parseFloat(event.target.value) || 0
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-right text-sm transition-colors hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                />
              )}
              {splitMode === 'percentage' && (
                <input
                  inputMode="decimal"
                  value={percentageValues[uid]?.toString() ?? ''}
                  onChange={event =>
                    setPercentageValues(prev => ({
                      ...prev,
                      [uid]: event.target.value === '' ? 0 : parseFloat(event.target.value) || 0
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-right text-sm transition-colors hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                  placeholder="%"
                />
              )}
              {splitMode === 'shares' && (
                <input
                  inputMode="decimal"
                  value={shareValues[uid]?.toString() ?? ''}
                  onChange={event =>
                    setShareValues(prev => ({
                      ...prev,
                      [uid]: event.target.value === '' ? 0 : parseFloat(event.target.value) || 0
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-right text-sm transition-colors hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                  placeholder="Shares"
                />
              )}
              {splitMode !== 'exact' && (
                <p className="mt-2 text-xs text-slate-500">
                  Amount: {roundCurrency(computedSplits[uid] ?? 0).toFixed(2)}
                </p>
              )}
              <div className="mt-2">
                <label className="text-xs text-slate-500">Adjustment</label>
                <input
                  inputMode="decimal"
                  value={adjustmentInputs[uid] ?? adjustments[uid]?.toString() ?? ''}
                  onChange={event => {
                    const value = event.target.value;
                    setAdjustmentInputs(prev => ({ ...prev, [uid]: value }));
                    const parsed = parseFloat(value);
                    if (!Number.isNaN(parsed)) {
                      setAdjustments(prev => ({ ...prev, [uid]: parsed }));
                    } else if (value === '' || value === '-') {
                      setAdjustments(prev => ({ ...prev, [uid]: 0 }));
                    }
                  }}
                  onBlur={() => {
                    const raw = adjustmentInputs[uid];
                    if (raw === undefined) return;
                    const parsed = parseFloat(raw);
                    setAdjustments(prev => ({ ...prev, [uid]: Number.isNaN(parsed) ? 0 : parsed }));
                    setAdjustmentInputs(prev => {
                      const next = { ...prev };
                      delete next[uid];
                      return next;
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-right text-sm transition-colors hover:border-slate-300 focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">Split total: {splitTotal.toFixed(2)}</p>
      </div>

      {status && <p className="text-sm text-rose-600">{status}</p>}

      <button type="submit" className="btn-primary w-full">
        {expense ? 'Update expense' : 'Save expense'}
      </button>
    </form>
  );
}

function QuickOptionButton({
  title,
  description,
  onClick,
  active
}: {
  title: string;
  description: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active ? 'border-brand bg-blue-50 text-brand' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
      }`}
    >
      <p className="font-semibold text-sm">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </button>
  );
}
