'use client';

import { JournalCalendar } from './JournalCalendar';
import { JournalStats } from './JournalStats';

export function JournalPage() {
  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <h1 className="mb-6 text-2xl font-semibold">Journal</h1>
      <JournalStats />
      <div className="mt-6">
        <JournalCalendar />
      </div>
    </div>
  );
}
