'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Import translations
import ru from '@/locales/ru.json';
import it from '@/locales/it.json';

export type Locale = 'ru' | 'it';

const translations: Record<Locale, typeof ru> = {
  ru,
  it,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ru'); // Default to Russian
  const [mounted, setMounted] = useState(false);

  // Fetch user's preferred language from API on mount
  useEffect(() => {
    const fetchUserLanguage = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user?.language && (data.user.language === 'ru' || data.user.language === 'it')) {
            setLocaleState(data.user.language as Locale);
          }
        }
      } catch {
        // Ignore errors, use default
      } finally {
        setMounted(true);
      }
    };

    fetchUserLanguage();
  }, []);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);

    // Save to user profile via API
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user?.id) {
          await fetch(`/api/users/${data.user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: newLocale }),
          });
        }
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Translation function with nested key support
  const t = useCallback((key: string, params?: Record<string, string>): string => {
    const keys = key.split('.');
    let value: unknown = translations[locale];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Key not found, return the key itself
        return key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters like {username}
    if (params) {
      let result = value;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(`{${paramKey}}`, paramValue);
      }
      return result;
    }

    return value;
  }, [locale]);

  // Don't render until we've checked user preference
  if (!mounted) {
    return null;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

// Helper hook that only returns the t function
export function useTranslation() {
  const { t } = useI18n();
  return { t };
}
