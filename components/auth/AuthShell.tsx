import React, { useEffect, useState } from 'react';
import { FluidCursor } from './FluidCursor';

type AuthShellProps = {
  children: React.ReactNode;
};

export const AuthShell: React.FC<AuthShellProps> = ({ children }) => {
  const [showClerk, setShowClerk] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowClerk(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white selection:bg-yellow-500/30">
      {/* Custom cursor (desktop only) */}
      <div className="hidden md:block">
        <FluidCursor />
      </div>

      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-[3px] scale-105"
          style={{
            backgroundImage: 'url(/background.png)',
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-black/30 to-black/90" />
      </div>

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pb-12">
        <div className="flex w-full max-w-lg flex-col items-center gap-10 animate-slide-up">
          {/* Logo + Pulse glow */}
          <div className="relative mb-2">
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-500/30 animate-pulse-radiate"
              style={{ boxShadow: '0 0 60px rgba(234,179,8,0.35)' }}
            />
            <div className="relative z-10 opacity-90 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
              <img src="/logo.png" alt="Pulse logo" className="h-24 w-24 object-contain" />
            </div>
          </div>

          {/* Window Frame */}
          <div className="relative w-full overflow-hidden rounded-[32px] p-[1px]">
            <div className="absolute inset-[-200%] animate-spin-slow bg-[conic-gradient(from_0deg,transparent_0_85%,#B45309_92%,#EAB308_100%)] opacity-80" />
            <div className="relative z-10 flex flex-col gap-6 rounded-[32px] bg-black/85 px-8 py-10 shadow-[0_25px_55px_rgba(0,0,0,0.65)]">
              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.5em] text-yellow-500/70">Pulse Terminal</p>
                <h1 className="text-2xl font-semibold tracking-[0.2em] text-yellow-50">Access Control</h1>
              </div>
              <div className={`transition-opacity duration-500 ${showClerk ? 'opacity-100' : 'opacity-0'}`}>
                {showClerk ? children : null}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-radiate {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        .animate-slide-up { animation: slide-up 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .animate-spin-slow { animation: spin-slow 5s linear infinite; }
        .animate-pulse-radiate { animation: pulse-radiate 2.2s infinite ease-out; }
      `}</style>
    </div>
  );
};
