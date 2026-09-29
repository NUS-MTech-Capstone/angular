import { WebDriver } from 'selenium-webdriver';

interface BrowserResponse<T> {
  ok: boolean;
  status: number;
  body: T | string | null;
  error?: string;
}

export async function authenticatedJson<T>(
  driver: WebDriver,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await driver.executeAsyncScript<BrowserResponse<T>>(
    `
      const path = arguments[0];
      const method = arguments[1];
      const body = arguments[2];
      const done = arguments[arguments.length - 1];
      const options = {
        method,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-api-version': '1',
        },
      };
      if (body !== null) options.body = JSON.stringify(body);
      fetch(new URL(path, window.location.origin), options)
        .then(async (result) => {
          const text = await result.text();
          let parsed = null;
          if (text) {
            try { parsed = JSON.parse(text); } catch { parsed = text; }
          }
          done({ ok: result.ok, status: result.status, body: parsed });
        })
        .catch((error) => done({ ok: false, status: 0, body: null, error: error.message }));
    `,
    path,
    method,
    body ?? null,
  );

  if (!response.ok) {
    const detail =
      typeof response.body === 'object' && response.body !== null
        ? String((response.body as Record<string, unknown>)['message'] ?? '')
        : '';
    throw new Error(
      `Authenticated request failed: ${method} ${path} (${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }
  return response.body as T;
}

export async function pollFor<T>(
  description: string,
  timeoutMs: number,
  probe: () => Promise<T | undefined>,
  intervalMs = 5000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await probe();
    if (result !== undefined) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const finalResult = await probe();
  if (finalResult !== undefined) {
    return finalResult;
  }
  throw new Error(`Timed out waiting for ${description}.`);
}
