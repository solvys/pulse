import { AppShell } from '@/components/layout/AppShell';
import { TheTape } from '@/components/tape/TheTape';
import { PriceChat } from '@/components/price/PriceChat';
import { RiskFlowPage } from '@/components/riskflow/RiskFlowPage';
import { JournalPage } from '@/components/journal/JournalPage';
import { EconCalendarPage } from '@/components/econ/EconCalendarPage';
import { useAppShell } from '@/hooks/useAppShell';

function Content() {
  const { currentSection } = useAppShell();

  switch (currentSection) {
    case 'tape':
      return <TheTape />;
    case 'price':
      return <PriceChat />;
    case 'riskflow':
      return <RiskFlowPage />;
    case 'journal':
      return <JournalPage />;
    case 'econ':
      return <EconCalendarPage />;
    default:
      return <TheTape />;
  }
}

function App() {
  return (
    <AppShell>
      <Content />
    </AppShell>
  );
}

export default App;