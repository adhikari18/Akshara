'use client';

import React from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { PARENT_NAV } from '@/components/shell/nav';
import { GrownUpGate } from '@/components/shell/GrownUpGate';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="parent" nav={PARENT_NAV}>
      <GrownUpGate area="Parent">{children}</GrownUpGate>
    </AppShell>
  );
}
