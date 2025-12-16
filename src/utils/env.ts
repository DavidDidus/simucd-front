// ⚙️ Detectar si estamos en desarrollo (Vite/CRA/Next)
export const IS_DEV = (() => {
  try {
    // Vite / ESM
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      return Boolean((import.meta as any).env.DEV);
    }
  } catch {}
  try {
    // CRA / Next (use globalThis to avoid TS error when 'process' types are not available)
    const proc = (globalThis as any).process;
    if (proc && proc.env) {
      return proc.env.NODE_ENV !== "production";
    }
  } catch {}
  return false;
})();
export const CAN_EDIT = IS_DEV; // 👈 Solo habilita edición en desarrollo
