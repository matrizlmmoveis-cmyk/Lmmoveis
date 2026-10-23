import { Store } from '../types.ts';

export const isSaoPauloStore = (storeOrIdOrName?: Store | { id?: string; name?: string } | string | null): boolean => {
  if (!storeOrIdOrName) return false;
  if (typeof storeOrIdOrName === 'string') {
    if (storeOrIdOrName === 'cd-sao-paulo') return true;
    const lower = storeOrIdOrName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes('sao paulo');
  }
  if (storeOrIdOrName.id === 'cd-sao-paulo') return true;
  const name = storeOrIdOrName.name || '';
  const lower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return lower.includes('sao paulo');
};

export const isStoreSaoPaulo = (storeIdOrStore?: string | Store | null, stores?: Store[]): boolean => {
  if (!storeIdOrStore) return false;
  if (typeof storeIdOrStore !== 'string') {
    return isSaoPauloStore(storeIdOrStore);
  }
  if (isSaoPauloStore(storeIdOrStore)) return true;
  if (stores && stores.length > 0) {
    const found = stores.find(s => s.id === storeIdOrStore);
    if (found && isSaoPauloStore(found)) return true;
  }
  return false;
};
