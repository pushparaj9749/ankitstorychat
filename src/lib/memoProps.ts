/**
 * Prop comparator for React.memo on presentational components (cards, icons).
 *
 * Screens pass inline handlers such as `onPress={() => openStory(item.id)}`.
 * Those are a new function on every render, which defeats React.memo's default
 * shallow compare, so every card re-rendered whenever its screen did (a
 * carousel page change, a keystroke, a filter tap). Here:
 *
 *  - function props are treated as equal: the handlers in this app are pure
 *    navigation/toggle closures over the same ids the data props describe;
 *  - `style` is compared by value (inline style arrays are new each render);
 *  - everything else uses Object.is.
 */
export function sameRenderProps<P extends object>(a: Readonly<P>, b: Readonly<P>): boolean {
  if (a === b) return true;
  const ka = Object.keys(a) as (keyof P)[];
  const kb = Object.keys(b) as (keyof P)[];
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    const va = a[k] as unknown;
    const vb = b[k] as unknown;
    if (Object.is(va, vb)) continue;
    if (typeof va === 'function' && typeof vb === 'function') continue;
    if (k === 'style' && sameStyle(va, vb)) continue;
    return false;
  }
  return true;
}

function sameStyle(a: unknown, b: unknown): boolean {
  if (!a && !b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
