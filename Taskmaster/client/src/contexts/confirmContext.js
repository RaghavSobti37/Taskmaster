import { createContext, useContext } from 'react';

export const ConfirmContext = createContext(null);

const defaultConfirm = async () => false;

/** Imperative confirm outside React components (prefer useConfirm in components). */
export const globalConfirm = {
  confirm: defaultConfirm,
};

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (ctx?.confirm) return ctx;
  if (globalConfirm.confirm !== defaultConfirm) {
    return { confirm: globalConfirm.confirm };
  }
  return { confirm: defaultConfirm };
}
