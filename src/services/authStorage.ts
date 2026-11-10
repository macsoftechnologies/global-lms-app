import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'lms_access_token';
const REFRESH_TOKEN_KEY = 'lms_refresh_token';
const USER_KEY = 'lms_user_profile';
const USER_ROLE_KEY = 'lms_user_role';
const ONBOARDING_COMPLETED_KEY = 'lms_has_completed_onboarding';
const ORGANIZATION_CODE_KEY = 'lms_organization_code';
const ORGANIZATION_DETAILS_KEY = 'lms_organization_details';

// In-memory fallback if SecureStore is unavailable
const memoryStorage: Record<string, string> = {};

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = value;
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (error) {
    console.warn(`[AuthStorage] Failed to save ${key}:`, error);
    memoryStorage[key] = value;
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStorage[key] || null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`[AuthStorage] Failed to get ${key}:`, error);
    return memoryStorage[key] || null;
  }
}

async function removeItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      delete memoryStorage[key];
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (error) {
    console.warn(`[AuthStorage] Failed to remove ${key}:`, error);
    delete memoryStorage[key];
  }
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  role: 'student' | 'faculty';
  user: {
    id: string;
    fullName: string;
    email: string;
    mobile?: string;
    role?: string;
    [key: string]: unknown;
  };
}

export const AuthStorage = {
  async saveSession(session: AuthSession): Promise<void> {
    await setItem(ACCESS_TOKEN_KEY, session.accessToken);
    if (session.refreshToken) {
      await setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    }
    await setItem(USER_ROLE_KEY, session.role);
    await setItem(USER_KEY, JSON.stringify(session.user));
  },

  async getAccessToken(): Promise<string | null> {
    return getItem(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return getItem(REFRESH_TOKEN_KEY);
  },

  async getUserRole(): Promise<'student' | 'faculty' | null> {
    const role = await getItem(USER_ROLE_KEY);
    return (role as 'student' | 'faculty') || null;
  },

  async getUser(): Promise<AuthSession['user'] | null> {
    const userStr = await getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  async clearSession(): Promise<void> {
    await removeItem(ACCESS_TOKEN_KEY);
    await removeItem(REFRESH_TOKEN_KEY);
    await removeItem(USER_ROLE_KEY);
    await removeItem(USER_KEY);
  },

  async hasCompletedOnboarding(): Promise<boolean> {
    const val = await getItem(ONBOARDING_COMPLETED_KEY);
    return val === 'true';
  },

  async setOnboardingCompleted(): Promise<void> {
    await setItem(ONBOARDING_COMPLETED_KEY, 'true');
  },

  async resetOnboarding(): Promise<void> {
    await removeItem(ONBOARDING_COMPLETED_KEY);
  },

  async setOrganizationCode(code: string): Promise<void> {
    await setItem(ORGANIZATION_CODE_KEY, code.trim());
  },

  async getOrganizationCode(): Promise<string | null> {
    return getItem(ORGANIZATION_CODE_KEY);
  },

  async setOrganizationDetails<T = unknown>(org: T): Promise<void> {
    await setItem(ORGANIZATION_DETAILS_KEY, JSON.stringify(org));
  },

  async getOrganizationDetails<T = unknown>(): Promise<T | null> {
    const raw = await getItem(ORGANIZATION_DETAILS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
};

export default AuthStorage;
