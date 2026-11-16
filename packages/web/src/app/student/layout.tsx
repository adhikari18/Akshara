'use client';

import React from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { STUDENT_NAV } from '@/components/shell/nav';
import { StudentChip } from '@/components/student/StudentChip';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="student" nav={STUDENT_NAV} actions={<StudentChip />}>
      {children}
    </AppShell>
  );
}
