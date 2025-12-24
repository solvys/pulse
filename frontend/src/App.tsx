import { useAuth } from '@clerk/clerk-react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell';
import { TheTape } from '@/components/tape/TheTape';
import { PriceChat } from '@/components/price/PriceChat';
import { RiskFlowPage } from '@/components/riskflow/RiskFlowPage';
import { JournalPage } from '@/components/journal/JournalPage';
import { EconCalendarPage } from '@/components/econ/EconCalendarPage';
import { useAppShell } from '@/hooks/useAppShell';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';

function ProtectedContent() {
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

function ProtectedApp() {
  return (
    <AppShell>
      <ProtectedContent />
    </AppShell>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/*" element={
        <RequireAuth>
          <ProtectedApp />
        </RequireAuth>
      } />
    </Routes>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return <SignInPage />;
  }

  return <>{children}</>;
}

export default App;