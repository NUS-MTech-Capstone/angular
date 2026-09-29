import { config } from '../config';

interface AuthConfigResponse {
  mode: 'dev' | 'alb';
  devUsers: Array<{ username: string; name: string; roles: string[] }>;
}

export async function ensureServicesAvailable(): Promise<void> {
  let backendError: string | undefined;

  if (config.live) {
    if (!config.cognitoUsername || !config.cognitoPassword) {
      throw new Error('Live E2E Cognito credentials were not loaded.');
    }
    if (!config.demoAlarmName) {
      throw new Error('Live E2E demo alarm name was not configured.');
    }

    for (const url of [config.baseUrl, `${config.baseUrl}/healthz`]) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Live service returned HTTP ${response.status} from ${url}`);
      }
    }
    return;
  }

  try {
    const response = await fetch(`${config.apiUrl}/auth/config`);
    if (!response.ok) {
      backendError = `Backend returned HTTP ${response.status} from ${config.apiUrl}/auth/config`;
    } else {
      const body = (await response.json()) as AuthConfigResponse;
      if (body.mode !== 'dev') {
        backendError =
          'Backend AUTH_MODE is not "dev". Start nest-backend with AUTH_MODE=dev for Selenium tests.';
      }
    }
  } catch (error) {
    backendError = `Backend is not reachable at ${config.apiUrl} (${(error as Error).message})`;
  }

  if (backendError) {
    throw new Error(`${backendError}\nStart the API with: cd nest-backend && npm run start:dev`);
  }

  try {
    const response = await fetch(config.baseUrl);
    if (!response.ok) {
      throw new Error(`Angular app returned HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `Angular app is not reachable at ${config.baseUrl} (${(error as Error).message})\n` +
        'Start the webapp with: cd angular && npm start',
    );
  }
}
