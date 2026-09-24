/**
 * Un outil LangGraph renvoie soit un objet structuré, soit une chaîne (message
 * d'échec en français), et le SDK la transporte en JSON sérialisé ou enveloppée
 * dans un `ToolMessage` (`{ content }`, parfois un tableau de blocs `text`).
 * On déballe ici, une fois, pour que les composants ne voient plus qu'un objet
 * utile ou la chaîne brute à afficher telle quelle.
 */
export const unwrapToolResult = (result: unknown, depth = 0): unknown => {
  if (depth > 3) return result;

  if (typeof result === 'string') {
    const text = result.trim();
    // Un message d'échec (« ❌ … », « 🕐 … ») n'est pas du JSON : il s'affiche tel quel.
    if (!text.startsWith('{') && !text.startsWith('[')) return result;
    try {
      return unwrapToolResult(JSON.parse(text), depth + 1);
    } catch {
      return result;
    }
  }

  if (Array.isArray(result)) {
    const texts = result
      .map((block) =>
        typeof block === 'object' && block !== null ? (block as { text?: unknown }).text : null
      )
      .filter((text): text is string => typeof text === 'string');
    return texts.length > 0 ? texts.join('\n') : result;
  }

  if (typeof result === 'object' && result !== null && 'content' in result) {
    return unwrapToolResult((result as { content: unknown }).content, depth + 1);
  }

  return result;
};

/** Le résultat déballé, s'il s'agit bien d'un objet ; `null` sinon (chargement, échec, chaîne). */
export const asRecord = (result: unknown): Record<string, unknown> | null => {
  const value = unwrapToolResult(result);
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

/** Le texte à afficher quand le résultat n'est pas un objet (message d'échec, en cours). */
export const asMessage = (result: unknown): string | null => {
  const value = unwrapToolResult(result);
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};
