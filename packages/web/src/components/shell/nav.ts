import type { NavItem } from './AppShell';

export const STUDENT_NAV: NavItem[] = [
  { href: '/student/', emoji: '🏠', ne: 'घर', label: 'Home' },
  { href: '/student/lessons/', emoji: '✏️', ne: 'लेखौं', label: 'Write' },
  { href: '/student/play/', emoji: '🎈', ne: 'खेलौं', label: 'Play' },
  { href: '/student/watch/', emoji: '🎬', ne: 'हेरौं', label: 'Watch' },
];

export const PARENT_NAV: NavItem[] = [
  { href: '/parent/', emoji: '📊', ne: 'प्रगति', label: 'Progress' },
  { href: '/parent/children/', emoji: '👧', ne: 'बालबालिका', label: 'Children' },
  { href: '/parent/settings/', emoji: '⚙️', ne: 'सेटिङ', label: 'Settings' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin/', emoji: '🗂️', ne: 'सामग्री', label: 'Content' },
  { href: '/admin/trainer/', emoji: '🧑‍🏫', ne: 'लेखाइ प्रशिक्षण', label: 'Trace trainer' },
  { href: '/admin/fonts/', emoji: '🔤', ne: 'फन्ट', label: 'Fonts' },
  { href: '/admin/demo/', emoji: '🎬', ne: 'डेमो', label: 'Tracing demo' },
];
