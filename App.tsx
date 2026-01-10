import { useState } from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { PsychProvider } from './contexts/PsychContext';
import { ThreadProvider } from './contexts/ThreadContext';
import { MainLayout } from './components/layout/MainLayout';
import { SettingsPanel } from './components/SettingsPanel';
import { NotificationContainer } from './components/NotificationToast';
import { PsychOrientationModal } from './components/psych/PsychOrientationModal';
import { AuthShell } from './components/auth/AuthShell';
import { pulseAppearance } from './components/auth/pulseAppearance';
// ERProvider removed - using component-based ER monitoring for stability

// Development mode: bypass Clerk authentication ONLY when explicitly enabled
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';

const DEBUG_ENDPOINT = 'http://127.0.0.1:7245/ingest/50c95ce7-65d5-47b9-89a4-349e601c30e6';
const DEFAULT_CLERK_DOMAIN = 'clerk.app.pricedinresearch.io';
const DEFAULT_CLERK_PROXY_URL = 'https://clerk.app.pricedinresearch.io';

const agentDebugLog = (entry: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
}) => {
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'debug-session',
      runId: 'initial',
      timestamp: Date.now(),
      ...entry,
    }),
  }).catch(() => {});
};

// Debug logging
if (DEV_MODE) {
  console.log('[DEV MODE] Bypass Auth:', BYPASS_AUTH, 'DEV:', import.meta.env.DEV, 'MODE:', import.meta.env.MODE, 'VITE_BYPASS_AUTH:', import.meta.env.VITE_BYPASS_AUTH);
}

function AppInner() {
  const [showSettings, setShowSettings] = useState(false);

  const appContent = (
    <AuthProvider>
      <SettingsProvider>
        <PsychProvider>
          <ThreadProvider>
            <div className="dark">
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap');
              
              * {
                scrollbar-width: thin;
                scrollbar-color: #D4AF37 #0a0a00;
              }
              
              *::-webkit-scrollbar {
                width: 8px;
                height: 8px;
              }
              
              *::-webkit-scrollbar-track {
                background: #0a0a00;
              }
              
              *::-webkit-scrollbar-thumb {
                background: #D4AF37;
                border-radius: 4px;
              }
              
              *::-webkit-scrollbar-thumb:hover {
                background: #FFD060;
              }
              
              .scanline-overlay {
                background: repeating-linear-gradient(
                  0deg,
                  rgba(255, 192, 56, 0.03) 0px,
                  rgba(255, 192, 56, 0.03) 1px,
                  transparent 1px,
                  transparent 2px
                );
                pointer-events: none;
              }
            `}</style>
              <MainLayout onSettingsClick={() => setShowSettings(true)} />
              {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
              <NotificationContainer />
              <PsychOrientationModal />
            </div>
          </ThreadProvider>
        </PsychProvider>
      </SettingsProvider>
    </AuthProvider>
  );

  // In dev mode with auth bypass, show app directly
  if (BYPASS_AUTH) {
    return appContent;
  }

  // Normal Clerk authentication flow
  return (
    <>
      <SignedOut>
        {(() => {
          // #region agent log
          agentDebugLog({
            hypothesisId: 'H3',
            location: 'App.tsx:97',
            message: 'Rendering SignedOut state',
            data: { bypassAuth: BYPASS_AUTH },
          });
          // #endregion
          return null;
        })()}
        <AuthShell>
          <SignIn
            appearance={pulseAppearance}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
          />
        </AuthShell>
      </SignedOut>
      <SignedIn>
        {appContent}
      </SignedIn>
    </>
  );
}

export default function App() {
  // Production Clerk publishable key
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  const clerkDomain = import.meta.env.VITE_CLERK_DOMAIN || DEFAULT_CLERK_DOMAIN;
  const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || DEFAULT_CLERK_PROXY_URL;

  // #region agent log
  agentDebugLog({
    hypothesisId: 'H1-H2',
    location: 'App.tsx:121',
    message: 'Clerk environment snapshot',
    data: {
      hasKey: Boolean(clerkKey),
      resolvedDomain: clerkDomain,
      resolvedProxy: clerkProxyUrl,
      bypassAuth: BYPASS_AUTH,
    },
  });
  // #endregion

  // In dev mode with auth bypass, skip ClerkProvider
  if (BYPASS_AUTH) {
    return <AppInner />;
  }

  return (
    <ClerkProvider publishableKey={clerkKey} domain={clerkDomain} proxyUrl={clerkProxyUrl}>
      <AppInner />
    </ClerkProvider>
  );
}
