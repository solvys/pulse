/**
 * Version Check Hook
 * Forces users to re-authenticate when the app version changes
 */

import { useEffect, useRef } from 'react';
import { useClerk, useAuth } from '@clerk/clerk-react';

// Get app version from build timestamp (injected at build time)
// Each build will have a unique timestamp, forcing re-auth on updates
const APP_VERSION = import.meta.env.BUILD_TIME || 'dev';

const VERSION_STORAGE_KEY = 'pulse_app_version';
const VERSION_CHECK_FLAG_KEY = 'pulse_version_check_done';

export function useVersionCheck() {
  const clerk = useClerk();
  const { isSignedIn } = useAuth();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Skip version check in development or if auth is bypassed
    const DEV_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development';
    const BYPASS_AUTH = DEV_MODE && import.meta.env.VITE_BYPASS_AUTH === 'true';
    
    if (BYPASS_AUTH) {
      return;
    }

    // Only check version when user is signed in
    if (!isSignedIn) {
      hasCheckedRef.current = false; // Reset when signed out
      return;
    }

    // Only check version once per mount when signed in
    if (hasCheckedRef.current) {
      return;
    }

    const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    
    // If version has changed, sign out to force re-authentication
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log('[VersionCheck] App version changed. Signing out to force re-authentication.', {
        oldVersion: storedVersion,
        newVersion: APP_VERSION,
      });
      
      // Store the new version BEFORE signing out to prevent loop
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      hasCheckedRef.current = true;
      
      // Sign out from Clerk
      if (clerk.signOut) {
        clerk.signOut().catch((error) => {
          console.error('[VersionCheck] Error signing out:', error);
        });
      }
    } else if (!storedVersion) {
      // First time or version not set - store current version
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      hasCheckedRef.current = true;
      console.log('[VersionCheck] Storing app version:', APP_VERSION);
    } else {
      // Version matches - mark as checked
      hasCheckedRef.current = true;
    }
  }, [clerk, isSignedIn]);
}
