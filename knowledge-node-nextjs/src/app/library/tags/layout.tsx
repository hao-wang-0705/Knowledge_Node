'use client';

import { ReactNode } from 'react';

interface TagLibraryLayoutProps {
  children: ReactNode;
}

export default function TagLibraryLayout({ children }: TagLibraryLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {children}
    </div>
  );
}
