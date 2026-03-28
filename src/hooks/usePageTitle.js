// src/hooks/usePageTitle.js
// Updates document.title on each route for better SEO and browser tab UX
import { useEffect } from 'react';

export default function usePageTitle(pageTitle) {
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const base = 'Verdant CRM';
    document.title = pageTitle ? `${pageTitle} – ${base}` : base;
    return () => { document.title = base; };
  }, [pageTitle]);
}
