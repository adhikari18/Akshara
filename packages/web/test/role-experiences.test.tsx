import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NUMERAL_LIST, STROKE_LIST } from '@akshara/data';
import RootPage from '@/app/page';
import StudentLayout from '@/app/student/layout';
import ParentLayout from '@/app/parent/layout';
import AdminLayout from '@/app/admin/layout';
import { STUDENT_NAV, PARENT_NAV, ADMIN_NAV } from '@/components/shell/nav';
import { StudentHome } from '@/components/student/StudentHome';
import { LessonMap } from '@/components/student/LessonMap';
import { nextStep } from '@/components/student/studentPath';
import { LetterQuiz, QUIZ_LENGTH, buildQuiz } from '@/components/student/LetterQuiz';
import { buildLessons } from '@/components/student/lessons';
import { ParentDashboard } from '@/components/parent/ParentDashboard';
import { ManageChildren } from '@/components/parent/ManageChildren';
import { ContentOverview } from '@/components/admin/ContentOverview';
import {
  addChild,
  getActiveChild,
  getProgressSnapshot,
  recordActivity,
  resetProgressCache,
  setActiveChild,
  summarize,
} from '@/lib/progress';
import { lockGrownUpArea } from '@/components/shell/GrownUpGate';

vi.mock('next/navigation', () => ({ usePathname: () => '/student/play/' }));

/** Seeded PRNG so quiz rounds are reproducible. */
function seeded(seed = 7) {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetProgressCache();
  lockGrownUpArea();
});

describe('role chooser', () => {
  it('offers the three separate experiences', () => {
    render(<RootPage />);
    expect(screen.getByRole('link', { name: /Student/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/student\/?$/)
    );
    expect(screen.getByRole('link', { name: /Parent/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/parent\/?$/)
    );
    expect(screen.getByRole('link', { name: /Admin/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/admin\/?$/)
    );
  });
});

describe('layouts', () => {
  it('gives each role its own navigation', () => {
    // A four-year-old gets four big doors, no more
    expect(STUDENT_NAV.map((n) => n.label)).toEqual(['Home', 'Write', 'Play', 'Watch']);
    expect(PARENT_NAV.map((n) => n.label)).toEqual(['Progress', 'Children', 'Settings']);
    expect(ADMIN_NAV.map((n) => n.label)).toEqual([
      'Content',
      'Trace trainer',
      'Fonts',
      'Tracing demo',
    ]);
    // Grown-up tools never appear in the student navigation
    expect(
      STUDENT_NAV.some((n) => n.href.startsWith('/admin') || n.href.startsWith('/parent'))
    ).toBe(false);
  });

  it('marks the current page in the student navigation', () => {
    render(
      <StudentLayout>
        <p>content</p>
      </StudentLayout>
    );
    const nav = screen.getByRole('navigation', { name: 'student navigation' });
    expect(within(nav).getByRole('link', { name: /Play/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('puts the parent and admin areas behind a grown-up check', async () => {
    const user = userEvent.setup();
    render(
      <ParentLayout>
        <p>secret parent stuff</p>
      </ParentLayout>
    );
    expect(screen.queryByText('secret parent stuff')).not.toBeInTheDocument();
    const question = screen.getByText(/What is \d+ × \d+\?/).textContent!;
    const [, a, b] = /(\d+) × (\d+)/.exec(question)!;

    await user.type(screen.getByRole('textbox'), '1');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Not quite/);

    const next = /(\d+) × (\d+)/.exec(screen.getByText(/What is/).textContent!)!;
    await user.type(screen.getByRole('textbox'), String(Number(next[1]) * Number(next[2])));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('secret parent stuff')).toBeInTheDocument();
    expect(Number(a) * Number(b)).toBeGreaterThan(0);

    // Unlocked for the session: the admin area opens straight away
    render(
      <AdminLayout>
        <p>admin tools</p>
      </AdminLayout>
    );
    expect(screen.getByText('admin tools')).toBeInTheDocument();
  });
});

describe('progress store', () => {
  it('records activity for the active child only, and summarises it', () => {
    recordActivity({ kind: 'letter', itemId: 'ka', stars: 3, accuracy: 90, mistakes: 0 });
    expect(getProgressSnapshot().activity).toHaveLength(0); // nobody picked: nothing saved

    const maya = addChild('Maya', '🦋');
    expect(getActiveChild()?.id).toBe(maya.id);
    recordActivity({ kind: 'letter', itemId: 'ka', stars: 1, accuracy: 50, mistakes: 3 });
    recordActivity({ kind: 'letter', itemId: 'ka', stars: 3, accuracy: 92, mistakes: 0 });
    recordActivity({ kind: 'letter', itemId: 'kha', stars: 1, accuracy: 40, mistakes: 4 });
    recordActivity({ kind: 'numeral', itemId: 'num-2', stars: 2, accuracy: 70, mistakes: 1 });
    recordActivity({ kind: 'quiz', itemId: 'ga', stars: 3, accuracy: 100, mistakes: 0 });
    recordActivity({ kind: 'quiz', itemId: 'gha', stars: 0, accuracy: 0, mistakes: 1 });

    const s = summarize(getProgressSnapshot().activity, maya.id);
    expect(s.lettersMastered).toBe(1);
    expect(s.numeralsMastered).toBe(1);
    expect(s.quizAnswered).toBe(2);
    expect(s.quizCorrect).toBe(1);
    expect(s.streakDays).toBe(1);
    expect(s.needsPractice[0]!.itemId).toBe('kha');
    expect(s.items.find((i) => i.itemId === 'ka')!.attempts).toBe(2);
    expect(s.last7Days[6]!.count).toBe(6);
  });
});

describe('student experience', () => {
  it('lays out lessons covering every letter and numeral exactly once', () => {
    const ids = buildLessons().flatMap((l) => l.glyphs.map((g) => g.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(STROKE_LIST.length + NUMERAL_LIST.length);
  });

  it('greets the learner with one next step and three doors, never the whole alphabet', () => {
    addChild('Arjun', '🐯');
    recordActivity({ kind: 'letter', itemId: 'a', stars: 3, accuracy: 95, mistakes: 0 });
    render(<StudentHome />);
    expect(screen.getByRole('heading', { name: /नमस्ते Arjun/ })).toBeInTheDocument();
    // अ is learned, so आ is up next
    expect(screen.getByRole('link', { name: 'Next: write आ' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/student\/trace\/?\?letter=aa$/)
    );
    const doors = within(screen.getByRole('navigation', { name: 'Student doors' })).getAllByRole(
      'link'
    );
    expect(doors.map((d) => d.textContent)).toEqual([
      expect.stringContaining('Write'),
      expect.stringContaining('Play'),
      expect.stringContaining('Watch'),
    ]);
    // No letter tiles on the home page
    expect(screen.queryByRole('link', { name: /^Write क/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link').length).toBeLessThan(6);
  });

  it('asks who you are when several children share the device', async () => {
    const user = userEvent.setup();
    addChild('Maya', '🦋');
    addChild('Arjun', '🐯');
    setActiveChild('');
    render(<StudentHome />);
    expect(screen.getByRole('heading', { name: /Who are you/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Arjun/ }));
    expect(screen.getByRole('heading', { name: /नमस्ते Arjun/ })).toBeInTheDocument();
  });

  it('shows the lesson map, then only one lesson’s letters at a time', () => {
    addChild('Sita', '🐼');
    recordActivity({ kind: 'letter', itemId: 'ka', stars: 3, accuracy: 95, mistakes: 0 });
    const { unmount } = render(<LessonMap />);
    const stops = within(screen.getByRole('list', { name: 'Lesson map' })).getAllByRole('link');
    expect(stops).toHaveLength(buildLessons().length);
    expect(screen.getByRole('link', { name: 'Vowels, up next' })).toBeInTheDocument();
    unmount();

    window.history.pushState({}, '', '/student/lessons/?lesson=consonants-कण्ठ्य');
    render(<LessonMap />);
    const tiles = within(screen.getByRole('list', { name: 'Throat letters letters' })).getAllByRole(
      'link'
    );
    expect(tiles).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Write क, 3 stars' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/student\/trace\/?\?letter=ka$/)
    );
    expect(screen.queryByRole('link', { name: /५/ })).not.toBeInTheDocument();
    window.history.pushState({}, '', '/');
  });

  it('picks the next step along the path', () => {
    const lessons = buildLessons();
    expect(nextStep(new Map(), lessons).glyph.id).toBe(lessons[0]!.glyphs[0]!.id);
    const all = new Map([...STROKE_LIST, ...NUMERAL_LIST].map((d) => [d.id, 3]));
    all.set('num-7', 1);
    const step = nextStep(all, lessons);
    expect(step.glyph.id).toBe('num-7');
    expect(step.href).toMatch(/\/student\/numbers\/\?n=7$/);
  });

  it('builds quiz rounds of distinct answers with four distinct options', () => {
    for (const mode of ['picture', 'sound', 'number'] as const) {
      const quiz = buildQuiz(mode, seeded());
      expect(quiz).toHaveLength(QUIZ_LENGTH);
      expect(new Set(quiz.map((q) => q.answer.id)).size).toBe(QUIZ_LENGTH);
      for (const q of quiz) {
        expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
        expect(q.options.map((o) => o.id)).toContain(q.answer.id);
      }
    }
  });

  it('plays a quiz to the end, scoring answers and saving them for the parent', async () => {
    const user = userEvent.setup();
    addChild('Sita', '🐼');
    render(<LetterQuiz random={seeded(3)} />);
    await user.click(screen.getByRole('button', { name: /चित्र हेरेर/ }));
    const quiz = buildQuiz('picture', seeded(3));
    for (let i = 0; i < QUIZ_LENGTH; i++) {
      // answer right on even questions, wrong on odd ones
      const q = quiz[i]!;
      const pick = i % 2 === 0 ? q.answer : q.options.find((o) => o.id !== q.answer.id)!;
      await user.click(screen.getByRole('button', { name: `Answer ${pick.character}` }));
      await user.click(screen.getByRole('button', { name: /Next|See my stars/ }));
    }
    expect(
      screen.getByRole('heading', { name: `स्याबास! ${QUIZ_LENGTH / 2}/${QUIZ_LENGTH}` })
    ).toBeInTheDocument();
    const quizRecords = getProgressSnapshot().activity.filter((a) => a.kind === 'quiz');
    expect(quizRecords).toHaveLength(QUIZ_LENGTH);
    expect(quizRecords.filter((a) => a.stars > 0)).toHaveLength(QUIZ_LENGTH / 2);
  });
});

describe('parent experience', () => {
  it('adds children and shows each child their own report', async () => {
    const user = userEvent.setup();
    render(<ManageChildren />);
    await user.type(screen.getByRole('textbox', { name: "Child's name" }), 'Maya');
    await user.click(screen.getByRole('button', { name: /Add/ }));
    await user.type(screen.getByRole('textbox', { name: "Child's name" }), 'Arjun');
    await user.click(screen.getByRole('radio', { name: 'Avatar 🐯' }));
    await user.click(screen.getByRole('button', { name: /Add/ }));
    expect(
      within(screen.getByRole('list', { name: 'Children on this device' })).getAllByRole('listitem')
    ).toHaveLength(2);

    // Maya (first, active) traces a letter
    act(() =>
      recordActivity({ kind: 'letter', itemId: 'ga', stars: 3, accuracy: 96, mistakes: 0 })
    );
    render(<ParentDashboard />);
    expect(screen.getByLabelText('Progress of Maya')).toBeInTheDocument();
    expect(screen.getByText('Letters learned').nextSibling).toHaveTextContent(
      `1/${STROKE_LIST.length}`
    );
    expect(screen.getByLabelText('ग: 3 stars')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Arjun/ }));
    expect(screen.getByText('Letters learned').nextSibling).toHaveTextContent(
      `0/${STROKE_LIST.length}`
    );
  });

  it('invites the parent to add a child when there are none', () => {
    render(<ParentDashboard />);
    expect(screen.getByRole('link', { name: /Add a child/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/parent\/children\/?$/)
    );
  });
});

describe('admin experience', () => {
  it('lists every glyph with its stroke count and data validity', () => {
    render(<ContentOverview />);
    const rows = screen.getAllByRole('row');
    expect(rows.length - 1).toBe(STROKE_LIST.length + NUMERAL_LIST.length);
    expect(screen.getAllByText('✓ valid').length).toBe(STROKE_LIST.length + NUMERAL_LIST.length);
  });
});
