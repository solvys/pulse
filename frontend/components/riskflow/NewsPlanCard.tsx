'use client';

interface NewsPlanCardProps {
  plan: string | null;
}

export function NewsPlanCard({ plan }: NewsPlanCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">News Plan for Day</h3>
      {plan ? (
        <p className="text-sm leading-relaxed">{plan}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No plan available. Use Econ Calendar to interpret today.</p>
      )}
    </div>
  );
}
