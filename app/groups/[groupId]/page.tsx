'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Timestamp } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { TopNav } from '@/components/TopNav';
import { useAuthContext } from '@/components/AuthProvider';
import { useGroupData } from '@/hooks/useGroupData';
import { Modal } from '@/components/Modal';
import { computeGroupNetBalances, roundCurrency, simplifySettlements } from '@/lib/calculations';
import {
  deleteGroupAndData,
  removeMemberFromGroup,
  softDeleteExpense,
  softDeletePayment
} from '@/lib/firestore';

export default function GroupDashboard() {
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const { group, members, expenses, payments, loading } = useGroupData(groupId);

  const getTimestampValue = (value?: number | null | Timestamp) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    return 0;
  };

  const visibleExpenses = expenses.filter(expense => !expense.isDeleted);

  const visiblePayments = payments.filter(payment => !payment.isDeleted);

  const timelineItems = [
    ...visibleExpenses.map(expense => ({ type: 'expense' as const, entry: expense })),
    ...visiblePayments.map(payment => ({ type: 'payment' as const, entry: payment }))
  ].sort((a, b) => getTimestampValue(b.entry.createdAt) - getTimestampValue(a.entry.createdAt));
  const [actionMessage, setActionMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showDeleteNameModal, setShowDeleteNameModal] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState('');
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ uid: string; name: string } | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<{ type: 'expense' | 'payment'; id: string } | null>(null);

  const balances = useMemo(() => {
    if (!group) return {};
    return computeGroupNetBalances(visibleExpenses, visiblePayments, members);
  }, [visibleExpenses, group, members, visiblePayments]);

  const settlements = useMemo(() => simplifySettlements(balances), [balances]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, router, user]);

  if (!groupId) return null;

  const closeDeleteFlow = () => {
    setShowDeleteNameModal(false);
    setShowDeleteDataModal(false);
    setDeleteNameInput('');
    setDeletingGroup(false);
  };

  const confirmDeleteGroup = async () => {
    if (!groupId || !group) return;
    setDeletingGroup(true);
    try {
      await deleteGroupAndData(groupId);
      closeDeleteFlow();
      router.push('/groups');
    } catch (error) {
      setActionMessage((error as Error).message);
      closeDeleteFlow();
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: group?.currency ?? 'USD' }).format(amount);

  const confirmDeleteEntry = async () => {
    if (!groupId || !entryToDelete) return;
    try {
      if (entryToDelete.type === 'expense') {
        await softDeleteExpense(groupId, entryToDelete.id);
        setActionMessage('Expense archived');
      } else {
        await softDeletePayment(groupId, entryToDelete.id);
        setActionMessage('Payment archived');
      }
    } catch (error) {
      setActionMessage((error as Error).message);
    } finally {
      setEntryToDelete(null);
    }
  };

  const closeMemberRemoval = () => {
    setMemberToRemove(null);
    setRemovingMember(false);
  };

  const handleRemoveMember = async () => {
    if (!groupId || !memberToRemove) return;
    setRemovingMember(true);
    try {
      await removeMemberFromGroup(groupId, memberToRemove.uid);
      setActionMessage('Member removed');
      closeMemberRemoval();
    } catch (error) {
      setActionMessage((error as Error).message);
      closeMemberRemoval();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <TopNav />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        {loading ? (
          <p className="text-slate-500">Loading group…</p>
        ) : !group ? (
          <p className="text-slate-500">Group not found.</p>
        ) : (
          <>
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase text-slate-400">Group</p>
                  <h1 className="text-2xl font-semibold">{group.name}</h1>
                  <p className="text-sm text-slate-500">Currency: {group.currency}</p>
                  <p className="text-sm text-slate-500">Share code: {group.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/groups/${group.id}/expenses/new`}
                    className="rounded-lg bg-brand px-4 py-2 font-medium text-white"
                  >
                    Add expense
                  </Link>
                  <Link
                    href={`/groups/${group.id}/settle`}
                    className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700"
                  >
                    Settle up
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Net balances</h2>
                <ul className="mt-4 space-y-2">
                  {members.map(member => {
                    const balance = balances[member.uid] ?? 0;
                    return (
                      <li key={member.uid} className="flex items-center justify-between text-sm">
                        <span>{member.displayName}</span>
                        <span className={balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatCurrency(balance)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Suggested settlements</h2>
                {settlements.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Group is already balanced.</p>
                ) : (
                  <ul className="mt-4 space-y-2 text-sm">
                    {settlements.map(s => {
                      const from = members.find(m => m.uid === s.fromUid)?.displayName ?? s.fromUid;
                      const to = members.find(m => m.uid === s.toUid)?.displayName ?? s.toUid;
                      return (
                        <li key={`${s.fromUid}-${s.toUid}`}>
                          <span className="font-medium">{from}</span> should pay <span>{formatCurrency(s.amount)}</span>{' '}
                          to <span className="font-medium">{to}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Members</h2>
                  <p className="text-sm text-slate-500">Share this code to invite people.</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(group.id);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 1500);
                  }}
                  className="min-w-[300px] rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 text-center"
                >
                  {copiedCode ? 'Copied!' : `Copy code: ${group.id}`}
                </button>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {members.map(member => (
                  <li key={member.uid} className="flex items-center justify-between">
                    <span>
                      {member.displayName}
                      {member.email ? ` · ${member.email}` : ''}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>
                        {member.role}
                        {member.status === 'removed' ? ' (removed)' : ''}
                      </span>
                      {member.status !== 'removed' && member.uid !== user?.uid && (
                        <button
                          onClick={() =>
                            setMemberToRemove({
                              uid: member.uid,
                              name: member.displayName || member.email || member.uid
                            })
                          }
                          className="text-rose-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {actionMessage && <p className="mt-2 text-sm text-slate-500">{actionMessage}</p>}

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Timeline</h2>
                <span className="text-sm text-slate-500">{timelineItems.length} entries</span>
              </div>
              {timelineItems.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No activity yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {timelineItems.map(item => {
                    const dateLabel = new Date(item.entry.date).toLocaleDateString('en-US', {
                      day: '2-digit',
                      month: 'short'
                    });
                    if (item.type === 'expense') {
                      const expense = item.entry;
                      const payerNames = expense.payers
                        .map((payer: { uid: string }) => members.find(member => member.uid === payer.uid)?.displayName ?? payer.uid)
                        .join(', ');
                      const userShare = expense.splits.find((split: { uid: string }) => split.uid === user?.uid)?.amount ?? 0;
                      const userContribution = expense.payers.find((payerLine: { uid: string }) => payerLine.uid === user?.uid)?.amount ?? 0;
                      const delta = roundCurrency(userContribution - userShare);
                      return (
                        <div
                          key={expense.id}
                          className="rounded-xl border border-slate-100 p-4 md:flex md:items-center md:justify-between md:gap-6"
                        >
                          <div className="md:flex-1">
                            <p className="text-xs uppercase text-slate-400">{dateLabel}</p>
                            <p className="mt-1 text-base font-medium text-slate-900 md:text-lg">{expense.description}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {payerNames} paid {formatCurrency(expense.totalAmount)}
                            </p>
                          </div>
                          <div className="mt-3 text-sm md:mt-0 md:text-right">
                            <p className={`font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {delta >= 0 ? 'You lent' : 'You borrowed'} {formatCurrency(Math.abs(delta))}
                            </p>
                            <div className="mt-3 flex gap-4 text-xs md:justify-end">
                              <Link href={`/groups/${group.id}/expenses/${expense.id}/edit`} className="text-brand">
                                Edit
                              </Link>
                              <button
                                onClick={() => setEntryToDelete({ type: 'expense', id: expense.id })}
                                className="text-rose-600"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const payment = item.entry;
                    const fromName = members.find(m => m.uid === payment.fromUid)?.displayName ?? payment.fromUid;
                    const toName = members.find(m => m.uid === payment.toUid)?.displayName ?? payment.toUid;
                    const affectsUser = payment.fromUid === user?.uid || payment.toUid === user?.uid;
                    const delta = payment.fromUid === user?.uid ? payment.amount : payment.toUid === user?.uid ? -payment.amount : 0;
                    return (
                      <div
                        key={payment.id}
                        className="rounded-xl border border-slate-100 p-4 md:flex md:items-center md:justify-between md:gap-6"
                      >
                        <div className="md:flex-1">
                          <p className="text-xs uppercase text-slate-400">{dateLabel}</p>
                          <p className="mt-1 text-base font-medium text-slate-900 md:text-lg">Settle up payment</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {fromName} paid {toName} {formatCurrency(payment.amount)}
                          </p>
                        </div>
                        <div className="mt-3 text-sm md:mt-0 md:text-right">
                          {affectsUser ? (
                            <p className={`font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {delta >= 0 ? 'You lent' : 'You borrowed'} {formatCurrency(Math.abs(delta))}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">Not involving you</p>
                          )}
                          <button
                            onClick={() => setEntryToDelete({ type: 'payment', id: payment.id })}
                            className="mt-3 text-xs text-rose-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            {members.find(member => member.uid === user?.uid)?.role === 'admin' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Danger zone</p>
                <p className="mt-1 text-xs text-slate-500">Deleting removes all expenses and payments.</p>
                <button
                  onClick={() => {
                    setDeleteNameInput('');
                    setShowDeleteNameModal(true);
                    setShowDeleteDataModal(false);
                  }}
                  className="mt-3 text-xs font-semibold text-rose-600"
                >
                  Delete group permanently
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Modal
        title="Delete group"
        open={showDeleteNameModal}
        onClose={closeDeleteFlow}
      >
        <p>
          Type <span className="font-semibold">{group?.name}</span> to confirm deletion.
        </p>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2"
          placeholder="Group name"
          value={deleteNameInput}
          onChange={event => setDeleteNameInput(event.target.value)}
        />
        <div className="flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2" onClick={closeDeleteFlow}>
            Cancel
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-white ${
              deleteNameInput === group?.name ? 'bg-rose-600' : 'bg-rose-300'
            }`}
            disabled={deleteNameInput !== group?.name}
            onClick={() => {
              setShowDeleteNameModal(false);
              setShowDeleteDataModal(true);
            }}
          >
            Continue
          </button>
        </div>
      </Modal>
      <Modal
        title="Confirm data deletion"
        open={showDeleteDataModal}
        onClose={closeDeleteFlow}
      >
        <p className="text-sm text-slate-600">
          This will delete all members, expenses, and payments inside <span className="font-semibold">{group?.name}</span>.
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2" onClick={closeDeleteFlow}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white disabled:bg-rose-300"
            disabled={deletingGroup}
            onClick={confirmDeleteGroup}
          >
            {deletingGroup ? 'Deleting…' : 'Delete group'}
          </button>
        </div>
      </Modal>
      <Modal
        title="Delete entry"
        open={Boolean(entryToDelete)}
        onClose={() => setEntryToDelete(null)}
      >
        <p className="text-sm text-slate-600">This will archive the selected item from the timeline.</p>
        <div className="flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2" onClick={() => setEntryToDelete(null)}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white"
            onClick={confirmDeleteEntry}
          >
            Delete
          </button>
        </div>
      </Modal>
      <Modal
        title="Remove member"
        open={Boolean(memberToRemove)}
        onClose={closeMemberRemoval}
      >
        <p className="text-sm text-slate-600">
          Remove <span className="font-semibold">{memberToRemove?.name}</span> from this group? They will lose
          access to expenses and balances.
        </p>
        <div className="flex justify-end gap-3">
          <button className="rounded-lg border border-slate-200 px-4 py-2" onClick={closeMemberRemoval}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white disabled:bg-rose-300"
            disabled={removingMember}
            onClick={handleRemoveMember}
          >
            {removingMember ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
