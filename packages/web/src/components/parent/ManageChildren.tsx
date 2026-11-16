'use client';

import React, { useState } from 'react';
import { AVATARS, addChild, removeChild, renameChild, setActiveChild } from '@/lib/progress';
import { useProgress } from '@/components/shell/useProgress';

/** Add, rename and remove learner profiles; pick who is learning on this device. */
export function ManageChildren() {
  const state = useProgress();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]!);

  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-black text-ink">बालबालिका • Children</h1>

      <form
        className="rounded-3xl border-2 border-line bg-card p-4 space-y-3"
        aria-label="Add a child"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          addChild(name, avatar);
          setName('');
        }}
      >
        <h2 className="font-black text-ink">Add a child</h2>
        <input
          aria-label="Child's name"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-xs rounded-xl border-2 border-line bg-sunken px-3 py-2 text-ink"
        />
        <div role="radiogroup" aria-label="Avatar" className="flex flex-wrap gap-1">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={avatar === a}
              aria-label={`Avatar ${a}`}
              onClick={() => setAvatar(a)}
              className={`h-10 w-10 rounded-xl text-2xl ${avatar === a ? 'bg-amber-200 ring-2 ring-amber-400' : 'bg-sunken'}`}
            >
              {a}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          ➕ Add
        </button>
      </form>

      <ul className="space-y-2" aria-label="Children on this device">
        {state.children.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-line bg-card p-3"
          >
            <span className="text-3xl" aria-hidden>
              {c.avatar}
            </span>
            <input
              aria-label={`Name of ${c.name}`}
              defaultValue={c.name}
              onBlur={(e) => renameChild(c.id, e.target.value)}
              className="rounded-xl border border-line bg-sunken px-2 py-1 font-bold text-ink"
            />
            {state.activeChildId === c.id ? (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
                Learning on this device
              </span>
            ) : (
              <button
                type="button"
                className="btn bg-sunken text-ink-soft"
                onClick={() => setActiveChild(c.id)}
              >
                Make active
              </button>
            )}
            <button
              type="button"
              className="ml-auto btn bg-rose-500 text-white"
              aria-label={`Remove ${c.name}`}
              onClick={() => {
                if (window.confirm(`Remove ${c.name} and all of their progress?`))
                  removeChild(c.id);
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-faint">
        Profiles and progress are stored only in this browser — nothing is sent anywhere.
      </p>
    </div>
  );
}
