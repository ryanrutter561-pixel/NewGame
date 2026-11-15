type Child = Node | string | number | null | undefined | false;

interface Props {
  class?: string;
  style?: string;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>;
  [attr: string]: unknown;
}

/** Tiny element builder: h('button', { class: 'btn', on: { click } }, 'Text'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Props | null = null, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'on') {
        for (const [evt, fn] of Object.entries(v as Props['on'] ?? {})) el.addEventListener(evt, fn as EventListener);
      } else if (k === 'class') el.className = String(v);
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.firstChild.remove();
}
