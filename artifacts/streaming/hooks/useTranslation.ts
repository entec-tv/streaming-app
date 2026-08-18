import { useAppStore } from "@/store/app-store";
import { translations, TranslationKey } from "@/constants/translations";

export function useTranslation() {
  const language = useAppStore(s => s.settings.language) || 'en';
  
  const t = (key: TranslationKey): string => {
    const langTranslations = translations[language] || translations.en;
    return langTranslations[key] || translations.en[key] || key;
  };

  const isRTL = language === 'ar';

  return { t, language, isRTL };
}
