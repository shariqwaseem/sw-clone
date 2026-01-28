'use client';

import { ReactNode } from 'react';

interface ModalProps {
  title: string;
  open: boolean;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ title, open, children, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm px-0 sm:px-4">
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl safe-bottom">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="mt-4 space-y-4 text-sm text-slate-700">{children}</div>
      </div>
    </div>
  );
}
