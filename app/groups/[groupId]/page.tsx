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
      <main className="mx-auto max-w-5xl space-y-6 sm:space-y-8 px-4 sm:px-6 py-6 sm:py-10">
        {loading ? (
          <p className="text-slate-500">Loading group...</p>
        ) : !group ? (
          <p className="text-slate-500">Group not found.</p>
        ) : (
          <>
            <section className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm uppercase text-slate-400">Group</p>
                  <h1 className="text-2xl font-semibold truncate">{group.name}</h1>
                  <p className="text-sm text-slate-500">Currency: {group.currency}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href={`/groups/${group.id}/expenses/new`}
                    className="btn-primary text-center"
                  >
                    Add expense
                  </Link>
                  <Link
                    href={`/groups/${group.id}/settle`}
                    className="btn-secondary text-center"
                  >
                    Settle up
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              <div className="card">
                <h2 className="text-lg font-semibold">Net balances</h2>
                <ul className="mt-4 space-y-3">
                  {members.map(member => {
                    const balance = balances[member.uid] ?? 0;
                    return (
                      <li key={member.uid} className="flex items-center justify-between text-sm">
                        <span className="truncate mr-2">{member.displayName}</span>
                        <span className={`font-medium shrink-0 ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(balance)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="card">
                <h2 className="text-lg font-semibold">Suggested settlements</h2>
                {settlements.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Group is already balanced.</p>
                ) : (
                  <ul className="mt-4 space-y-3 text-sm">
                    {settlements.map(s => {
                      const from = members.find(m => m.uid === s.fromUid)?.displayName ?? s.fromUid;
                      const to = members.find(m => m.uid === s.toUid)?.displayName ?? s.toUid;
                      return (
                        <li key={`${s.fromUid}-${s.toUid}`} className="leading-relaxed">
                          <span className="font-medium">{from}</span> pays <span className="font-medium text-brand">{formatCurrency(s.amount)}</span>{' '}
                          to <span className="font-medium">{to}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Members</h2>
                  <p className="text-sm text-slate-500">Share the invite link to add people.</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invite/${group.id}`);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 1500);
                  }}
                  className="btn-secondary w-full sm:w-auto"
                >
                  {copiedCode ? 'Copied!' : 'Copy invite link'}
                </button>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {members.map(member => (
                  <li key={member.uid} className="flex items-center justify-between gap-2 py-1">
                    <span className="truncate">
                      {member.displayName}
                      <span className="hidden sm:inline text-slate-400">{member.email ? ` · ${member.email}` : ''}</span>
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
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
                          className="text-rose-600 hover:text-rose-700 py-1 px-2 -mr-2"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {actionMessage && <p className="text-sm text-slate-500">{actionMessage}</p>}

            <section className="card">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Timeline</h2>
                <span className="text-sm text-slate-500">{timelineItems.length} entries</span>
              </div>
              {timelineItems.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No activity yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
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
                          className="rounded-xl border border-slate-100 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/50"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs uppercase text-slate-400">{dateLabel}</p>
                              <p className="mt-1 text-base font-medium text-slate-900 truncate">{expense.description}</p>
                              <p className="mt-1 text-sm text-slate-600 truncate">
                                {payerNames} paid {formatCurrency(expense.totalAmount)}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
                              <p className={`font-medium text-sm ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {delta >= 0 ? 'You lent' : 'You borrowed'} {formatCurrency(Math.abs(delta))}
                              </p>
                              <div className="flex gap-4 text-xs">
                                <Link href={`/groups/${group.id}/expenses/${expense.id}/edit`} className="text-brand hover:text-brand-dark py-1">
                                  Edit
                                </Link>
                                <button
                                  onClick={() => setEntryToDelete({ type: 'expense', id: expense.id })}
                                  className="text-rose-600 hover:text-rose-700 py-1"
                                >
                                  Delete
                                </button>
                              </div>
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
                        className="rounded-xl border border-slate-100 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/50"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs uppercase text-slate-400">{dateLabel}</p>
                            <p className="mt-1 text-base font-medium text-slate-900">Settle up payment</p>
                            <p className="mt-1 text-sm text-slate-600 truncate">
                              {fromName} paid {toName} {formatCurrency(payment.amount)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
                            {affectsUser ? (
                              <p className={`font-medium text-sm ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {delta >= 0 ? 'You lent' : 'You borrowed'} {formatCurrency(Math.abs(delta))}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-500">Not involving you</p>
                            )}
                            <button
                              onClick={() => setEntryToDelete({ type: 'payment', id: payment.id })}
                              className="text-xs text-rose-600 hover:text-rose-700 py-1"
                            >
                              Delete
                            </button>
                          </div>
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
                  className="mt-3 text-xs font-semibold text-rose-600 hover:text-rose-700 py-1"
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
          className="input-base"
          placeholder="Group name"
          value={deleteNameInput}
          onChange={event => setDeleteNameInput(event.target.value)}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={closeDeleteFlow}>
            Cancel
          </button>
          <button
            className={`btn ${
              deleteNameInput === group?.name ? 'bg-danger text-white hover:bg-danger-dark' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
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
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={closeDeleteFlow}>
            Cancel
          </button>
          <button
            className="btn-danger disabled:opacity-50"
            disabled={deletingGroup}
            onClick={confirmDeleteGroup}
          >
            {deletingGroup ? 'Deleting...' : 'Delete group'}
          </button>
        </div>
      </Modal>
      <Modal
        title="Delete entry"
        open={Boolean(entryToDelete)}
        onClose={() => setEntryToDelete(null)}
      >
        <p className="text-sm text-slate-600">This will archive the selected item from the timeline.</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={() => setEntryToDelete(null)}>
            Cancel
          </button>
          <button
            className="btn-danger"
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
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-secondary" onClick={closeMemberRemoval}>
            Cancel
          </button>
          <button
            className="btn-danger disabled:opacity-50"
            disabled={removingMember}
            onClick={handleRemoveMember}
          >
            {removingMember ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
