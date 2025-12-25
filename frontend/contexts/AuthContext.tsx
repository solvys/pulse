import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useBackend } from '../lib/backend';

export type UserTier = 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';

interface OnboardingData {
  hasCompletedOnboarding: boolean;
  tradingStyle?: string;
  experienceLevel?: string;
  riskTolerance?: string;
}

interface AuthContextType {
  tier: UserTier;
  setTier: (tier: UserTier) => void;
  onboardingData: OnboardingData;
  setOnboardingData: (data: OnboardingData) => void;
  isAuthenticated: boolean;
  userId: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user } = useUser();
  const clerkUserId = user?.id;
  const backend = useBackend();
  const [tier, setTierState] = useState<UserTier>('free');
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    hasCompletedOnboarding: false,
  });
  const [isLoading, setIsLoading] = useState(true);

    // Wrapper to persist tier changes to backend
  const setTier = (newTier: UserTier) => {
    setTierState(newTier);
    // Persist to backend asynchronously (fire-and-forget for immediate UI update)
    if (isSignedIn && clerkUserId) {
      backend.updateAccountTier({ tier: newTier }).catch((error) => {
        console.error('Failed to update tier:', error);
        // Revert on error
        backend.getAccount()
          .then((account) => {
            if (account.tier) {
              setTierState(account.tier);
            }
          })
          .catch((getError) => {
            console.error('Failed to revert tier:', getError);
          });
      });
    }
  };

  useEffect(() => {
    async function initializeUser() {
      if (isSignedIn && clerkUserId) {
        try {
          const account = await backend.getAccount();
          // Always load tier from backend account (persistent across sessions)
          if (account.tier) {
            setTierState(account.tier);
          } else {
            // Fallback to free if tier is somehow missing
            setTierState('free');
          }
        } catch (error: any) {
          if (error?.message?.includes('not found') || error?.status === 404) {
            try {
              const newAccount = await backend.createAccount({ initialBalance: 10000 });
              await backend.syncProjectX({ username: '', apiKey: '' }); // This might need proper credentials
              // Set tier from newly created account (defaults to 'free')
              if (newAccount.tier) {
                setTierState(newAccount.tier);
              } else {
                setTierState('free');
              }
            } catch (createError) {
              console.error('Failed to create account:', createError);
              setTierState('free');
            }
          } else {
            console.error('Failed to get account:', error);
            // Don't reset tier on error - keep current state
          }
        }
      } else {
        // Reset to free tier when signed out
        setTierState('free');
      }
      setIsLoading(false);
    }

    // Always initialize when auth state changes
    initializeUser();
  }, [isSignedIn, clerkUserId, backend]);

  return (
    <AuthContext.Provider
      value={{
        tier: tier,
        setTier: setTier,
        onboardingData,
        setOnboardingData,
        isAuthenticated: isSignedIn || false,
        userId: clerkUserId || null,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
