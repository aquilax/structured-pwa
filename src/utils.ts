export const getLocaleDateTime = (d: Date): string => {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, -5); // remove timezone, ms
};

export const run = <T>(cb: () => T): T => cb();

export const dom = (tag: string, attributes: Record<string, any> = {}, ...children: Array<string | HTMLElement>) => {
  const element = document.createElement(tag);
  for (const attribute in attributes) {
    if (attributes.hasOwnProperty(attribute)) {
      element.setAttribute(attribute, attributes[attribute]);
    }
  }
  if (children) {
    const fragment = run(() => {
      const fragment = document.createDocumentFragment();
      children.forEach((child) => {
        if (typeof child === "string") {
          fragment.appendChild(document.createTextNode(child));
        } else {
          fragment.appendChild(child);
        }
      });
      return fragment;
    });
    element.appendChild(fragment);
  }
  return element;
};

export const debounce = <F extends (...args: any) => any>(cb: F, wait: number): F => {
  let h: any
  const callable = (...args: any) => {
    clearTimeout(h)
    h = setTimeout(() => cb(...args), wait);
  }
  return <F>(callable);
}