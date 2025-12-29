import { useState } from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ThreadProvider } from './contexts/ThreadContext';
import { MainLayout } from './components/layout/MainLayout';
import { SettingsPanel } from './components/SettingsPanel';
import { NotificationContainer } from './components/NotificationToast';
// ERProvider removed - using component-based ER monitoring for stability

// Development mode: bypass Clerk authentication ONLY when explicitly enabled
const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
const BYPASS_AUTH = DEV_MODE && (import.meta.env.VITE_BYPASS_AUTH === 'true' || !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

// Debug logging
if (DEV_MODE) {
  console.log('[DEV MODE] Bypass Auth:', BYPASS_AUTH, 'DEV:', import.meta.env.DEV, 'MODE:', import.meta.env.MODE, 'VITE_BYPASS_AUTH:', import.meta.env.VITE_BYPASS_AUTH);
}

function AppInner() {
  const [showSettings, setShowSettings] = useState(false);

  const appContent = (
    <AuthProvider>
      <SettingsProvider>
        <ThreadProvider>
          <div className="dark">
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap');
              
              * {
                scrollbar-width: thin;
                scrollbar-color: #FFC038 #0a0a00;
              }
              
              *::-webkit-scrollbar {
                width: 8px;
                height: 8px;
              }
              
              *::-webkit-scrollbar-track {
                background: #0a0a00;
              }
              
              *::-webkit-scrollbar-thumb {
                background: #FFC038;
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
          </div>
        </ThreadProvider>
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
        <div className="min-h-screen bg-[#050500] flex items-center justify-center p-4">
          <SignIn
            appearance={{
              baseTheme: undefined,
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-[#0a0a00] border border-[#FFC038]/20 shadow-[0_0_24px_rgba(255,192,56,0.15)]',
                headerTitle: 'text-[#FFC038]',
                headerSubtitle: 'text-zinc-400',
                socialButtonsBlockButton: 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white',
                formButtonPrimary: 'bg-[#FFC038] hover:bg-[#FFC038]/90 text-black',
                footerActionLink: 'text-[#FFC038] hover:text-[#FFC038]/80',
                formFieldInput: 'bg-zinc-800 border-zinc-700 text-white',
                formFieldLabel: 'text-zinc-300',
                dividerLine: 'bg-zinc-700',
                dividerText: 'text-zinc-500',
                identityPreviewEditButton: 'text-[#FFC038]',
              },
            }}
          />
        </div>
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

  // In dev mode with auth bypass, skip ClerkProvider
  if (BYPASS_AUTH) {
    return <AppInner />;
  }

  return (
    <ClerkProvider publishableKey={clerkKey}>
      <AppInner />
    </ClerkProvider>
  );
}
