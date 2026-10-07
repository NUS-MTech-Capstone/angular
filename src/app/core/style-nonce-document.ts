/** Scope CSP nonces to xterm's generated styles without changing the global DOM. */
export function withStyleNonce(document: Document, nonce: string | null): Document {
  if (!nonce) {
    return document;
  }

  return new Proxy(document, {
    get(target, property) {
      if (property === 'createElement') {
        return (tagName: string, options?: ElementCreationOptions) => {
          const element = target.createElement(tagName, options);
          if (element.tagName === 'STYLE') {
            element.setAttribute('nonce', nonce);
          }
          // xterm 6.0.0's CoreBrowserService bypasses documentOverride for its
          // scrollbar stylesheet. Intercept insertion only on xterm-owned divs
          // so that stylesheet also receives the nonce before entering the DOM.
          if (element.tagName === 'DIV') {
            const appendChild = element.appendChild;
            element.appendChild = function <T extends Node>(child: T): T {
              if (child instanceof HTMLStyleElement) {
                child.nonce = nonce;
              }
              return appendChild.call(this, child) as T;
            };
          }
          return element;
        };
      }

      // DOM accessors and methods must use the real Document as their receiver.
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
