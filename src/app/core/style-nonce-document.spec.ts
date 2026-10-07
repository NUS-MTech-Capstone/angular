import { withStyleNonce } from './style-nonce-document';

describe('withStyleNonce', () => {
  it('uses the original document when no CSP nonce is configured', () => {
    expect(withStyleNonce(document, null)).toBe(document);
  });

  it('sets the nonce before an xterm style is inserted or populated', () => {
    const scoped = withStyleNonce(document, 'response-nonce');
    const style = scoped.createElement('style');
    expect(style.nonce).toBe('response-nonce');
    expect(style.isConnected).toBe(false);
    style.textContent = '.xterm { color: red; }';
    expect(style.nonce).toBe('response-nonce');
  });

  it('nonces scrollbar styles from the native document before insertion', () => {
    const scoped = withStyleNonce(document, 'response-nonce');
    const screen = scoped.createElement('div');
    document.body.appendChild(screen);
    const style = document.createElement('style');
    expect(screen.appendChild(style)).toBe(style);
    expect(style.nonce).toBe('response-nonce');
    expect(style.isConnected).toBe(true);
    style.textContent = '.xterm-scrollable-element { color: red; }';
    screen.remove();
    expect(document.createElement('div').appendChild).toBe(Node.prototype.appendChild);
  });

  it('preserves native document identity, accessors and method receivers', () => {
    const scoped = withStyleNonce(document, 'response-nonce');
    expect(scoped instanceof Document).toBe(true);
    expect(scoped.body).toBe(document.body);
    expect(scoped.querySelector('body')).toBe(document.body);
    expect(scoped.createDocumentFragment().ownerDocument).toBe(document);
  });

  it('does not nonce other elements or modify global element creation', () => {
    const createElement = document.createElement;
    const scoped = withStyleNonce(document, 'response-nonce');
    expect(scoped.createElement('div').hasAttribute('nonce')).toBe(false);
    expect(document.createElement).toBe(createElement);
    expect(document.createElement('style').nonce).toBe('');
  });
});
