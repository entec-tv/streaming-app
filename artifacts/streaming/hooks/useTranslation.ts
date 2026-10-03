import { useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import { translations, TranslationKey } from "@/constants/translations";

export function useTranslation() {
  const language = useAppStore(s => s.settings.language) || 'en';
  
  const t = useCallback((key: TranslationKey): string => {
    const langTranslations = translations[language] || translations.en;
    return langTranslations[key] || translations.en[key] || key;
  }, [language]);

  const isRTL = language === 'ar';

  return { t, language, isRTL };
}

