'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { makeT, type Locale, type T } from './i18n';

// Functions cannot cross from server to client components, so the root layout
// passes only the locale string; client components rebuild the same translator.
const LocaleContext = createContext<Locale>('zh-Hant');

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** For client components: the same translator the server's getT() returns. */
export function useT(): T {
  const locale = useContext(LocaleContext);
  return useMemo(() => makeT(locale), [locale]);
}
