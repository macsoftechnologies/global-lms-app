import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const THEME_STORAGE_KEY = 'lms_theme_mode';

export interface ThemeColors {
  isDark: boolean;
  background: string;
  surface: string;
  card: string;
  cardBorder: string;
  cardBorderSubtle: string;
  sidebarBackground: string;
  sidebarBorder: string;
  topBarBackground: string;
  topBarBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  inputBackground: string;
  inputBorder: string;
  modalBackground: string;
  modalBackdrop: string;
  statusSuccess: string;
  statusSuccessBg: string;
  statusWarning: string;
  statusWarningBg: string;
  statusDanger: string;
  statusDangerBg: string;
  statusInfo: string;
  statusInfoBg: string;
  divider: string;
  iconColor: string;
  badgeBackground: string;
  badgeText: string;
}

export const LightTheme: ThemeColors = {
  isDark: false,
  background: '#F8FAFC',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  cardBorderSubtle: '#F1F5F9',
  sidebarBackground: '#0F172A',
  sidebarBorder: '#1E293B',
  topBarBackground: '#FFFFFF',
  topBarBorder: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  inputBackground: '#F8FAFC',
  inputBorder: '#E2E8F0',
  modalBackground: '#FFFFFF',
  modalBackdrop: 'rgba(15, 23, 42, 0.65)',
  statusSuccess: '#059669',
  statusSuccessBg: '#DCFCE7',
  statusWarning: '#D97706',
  statusWarningBg: '#FEF3C7',
  statusDanger: '#DC2626',
  statusDangerBg: '#FEE2E2',
  statusInfo: '#0284C7',
  statusInfoBg: '#E0F2FE',
  divider: '#E2E8F0',
  iconColor: '#475569',
  badgeBackground: '#EF4444',
  badgeText: '#FFFFFF',
};

export const DarkTheme: ThemeColors = {
  isDark: true,
  background: '#0B0F19',
  surface: '#111827',
  card: '#161F30',
  cardBorder: '#283548',
  cardBorderSubtle: '#1E293B',
  sidebarBackground: '#070A12',
  sidebarBorder: '#1E293B',
  topBarBackground: '#111827',
  topBarBorder: '#1F2937',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#6366F1',
  primaryLight: 'rgba(99, 102, 241, 0.18)',
  inputBackground: '#1A2333',
  inputBorder: '#2E3D52',
  modalBackground: '#161F30',
  modalBackdrop: 'rgba(0, 0, 0, 0.82)',
  statusSuccess: '#34D399',
  statusSuccessBg: 'rgba(16, 185, 129, 0.2)',
  statusWarning: '#FBBF24',
  statusWarningBg: 'rgba(245, 158, 11, 0.2)',
  statusDanger: '#F87171',
  statusDangerBg: 'rgba(239, 68, 68, 0.2)',
  statusInfo: '#38BDF8',
  statusInfoBg: 'rgba(56, 189, 248, 0.2)',
  divider: '#1F2937',
  iconColor: '#94A3B8',
  badgeBackground: '#EF4444',
  badgeText: '#FFFFFF',
};

// In-memory fallback
let memoryThemeMode: string | null = null;

async function saveThemePreference(mode: 'dark' | 'light'): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
    } else {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, mode);
    }
    memoryThemeMode = mode;
  } catch (err) {
    console.warn('[ThemeContext] Failed to persist theme preference:', err);
    memoryThemeMode = mode;
  }
}

async function getThemePreference(): Promise<'dark' | 'light' | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (val === 'dark' || val === 'light') return val;
      }
      return (memoryThemeMode as 'dark' | 'light') || null;
    }
    const val = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
    if (val === 'dark' || val === 'light') return val;
    return (memoryThemeMode as 'dark' | 'light') || null;
  } catch (err) {
    console.warn('[ThemeContext] Failed to retrieve theme preference:', err);
    return (memoryThemeMode as 'dark' | 'light') || null;
  }
}

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
  theme: ThemeColors;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  setTheme: () => {},
  theme: LightTheme,
  colors: LightTheme,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Load saved theme on mount
  useEffect(() => {
    let isMounted = true;
    getThemePreference().then((saved) => {
      if (isMounted && saved !== null) {
        setIsDarkMode(saved === 'dark');
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const setTheme = useCallback((dark: boolean) => {
    setIsDarkMode(dark);
    saveThemePreference(dark ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      saveThemePreference(next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const currentTheme = useMemo(() => {
    return isDarkMode ? DarkTheme : LightTheme;
  }, [isDarkMode]);

  const value = useMemo(
    () => ({
      isDarkMode,
      toggleTheme,
      setTheme,
      theme: currentTheme,
      colors: currentTheme,
    }),
    [isDarkMode, toggleTheme, setTheme, currentTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

