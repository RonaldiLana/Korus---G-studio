/**
 * Correções de URL para compatibilidade com domínios legados
 */

// Get the correct API base URL
export const getApiUrl = (): string => {
  return (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'https://korus.me';
};

// Fix legacy URLs with old domain
export const fixLegacyUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  // Substitui domínio antigo pelo novo
  return url.replace(/https:\/\/korus-backend-a55k\.onrender\.com/g, 'https://korus.me');
};
