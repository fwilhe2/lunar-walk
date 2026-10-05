/* Elements index.html is known to have. A missing one is a bug in the
   page, not a state to handle, so the lookup fails loudly instead of
   every use checking for null; kind also checks the element's type. */
export function byId(id: string): HTMLElement;
export function byId<T extends HTMLElement>(id: string, kind: new () => T): T;
export function byId(id: string, kind: new () => HTMLElement = HTMLElement): HTMLElement {
  const el = document.getElementById(id);
  if (!(el instanceof kind)) throw new Error('#' + id + ' is missing from index.html or is not a ' + kind.name);
  return el;
}
