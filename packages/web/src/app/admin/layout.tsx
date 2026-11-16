'use client';

import React from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ADMIN_NAV } from '@/components/shell/nav';
import { GrownUpGate } from '@/components/shell/GrownUpGate';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="admin" nav={ADMIN_NAV}>
      <GrownUpGate area="Admin">{children}</GrownUpGate>
    </AppShell>
  );
}
