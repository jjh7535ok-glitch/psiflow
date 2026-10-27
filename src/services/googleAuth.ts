import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Designated owner email for this application
export const OWNER_EMAIL = 'jjh7535ok@gmail.com';

// Initialize Firebase App singleton safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Enable browser local persistence so sessions survive browser tabs, restarts, and reloads
try {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
} catch {
  // ignore
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

/**
 * Returns saved owner email. Default to OWNER_EMAIL in AI Studio so the user
 * doesn't need to manually click login popup repeatedly when working on their app.
 */
export const getSavedAuthEmail = (): string => {
  try {
    const saved = localStorage.getItem('psi_flow_authenticated_email');
    if (saved) return saved;
  } catch {
    // ignore
  }
  return OWNER_EMAIL;
};

/**
 * Initialize auth listener.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string, isOwner: boolean) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && user.email) {
      const isOwner = user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
      try {
        localStorage.setItem('psi_flow_authenticated_email', user.email.toLowerCase());
      } catch {
        // ignore
      }
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken || '', isOwner);
      }
    } else {
      // Note: In an iframe (like AI Studio Build preview) or cross-origin Cloud Run,
      // third-party cookie partitioning may cause onAuthStateChanged to report user: null
      // even while the creator is actively logged into Google in the parent tab.
      // We do NOT clear localStorage here so the user remains identified as the author.
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Perform Google Sign-in popup and cache access token in memory.
 */
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
  isOwner: boolean;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || (await result.user.getIdToken());

    cachedAccessToken = token;
    const isOwner = result.user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
    
    if (result.user.email) {
      try {
        localStorage.setItem('psi_flow_authenticated_email', result.user.email.toLowerCase());
      } catch {}
    }

    return {
      user: result.user,
      accessToken: token,
      isOwner,
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Return current in-memory access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign out and clear cached token and local owner session.
 */
export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch {}
  cachedAccessToken = null;
  try {
    localStorage.removeItem('psi_flow_authenticated_email');
    localStorage.setItem('psi_flow_guest_mode', 'true');
  } catch {}
};

/**
 * Check if a given user is the designated system owner.
 */
export const checkIsOwner = (user: User | null): boolean => {
  if (!user || !user.email) return false;
  return user.email.toLowerCase() === OWNER_EMAIL.toLowerCase();
};
