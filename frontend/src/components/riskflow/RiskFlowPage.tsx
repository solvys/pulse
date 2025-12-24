'use client';

import { KPIRow } from './KPIRow';

export function RiskFlowPage() {
  return (
    <div className="flex h-full flex-col overflow-auto p-4">
      <h1 className="mb-6 text-2xl font-semibold">Risk Flow</h1>
      <KPIRow />
    </div>
  );
}
