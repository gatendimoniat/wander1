import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const SUPPORTED_LANGUAGES = ['es', 'ca', 'en'] as const;

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const current = i18n.language as typeof SUPPORTED_LANGUAGES[number];

  const toggle = () => {
    const currentIndex = SUPPORTED_LANGUAGES.indexOf(current);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LANGUAGES.length;
    i18n.changeLanguage(SUPPORTED_LANGUAGES[nextIndex]);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground/90 transition px-2 py-1.5 rounded hover:bg-sidebar-accent"
      title={t('language.change')}
    >
      <Globe className="w-3.5 h-3.5" />
      <span className="font-medium uppercase">{current}</span>
    </button>
  );
}
