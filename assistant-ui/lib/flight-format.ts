/**
 * AirLabs renvoie des datetimes complets (« 2026-09-24 08:10 ») là où un tableau
 * ou une carte n'affiche qu'une heure d'aéroport. On garde « HH:MM » quand la
 * chaîne en contient un, et on laisse passer tout le reste tel quel (chaîne déjà
 * courte, vide ou nulle).
 */
export const shortClock = (value: string | null): string | null =>
  value != null && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.slice(11, 16) : value;
