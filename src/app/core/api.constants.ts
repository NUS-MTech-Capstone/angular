import { environment } from '../../environments/environment';

export const SERVICE_NAME = 'ddm';
export const API_VERSION = '1';
export const API_VERSION_HEADER = 'x-api-version';

export const apiBaseUrl = `${environment.apiUrl}/${SERVICE_NAME}`;
export const gatewayBaseUrl = environment.gatewayUrl ?? '';

export const apiPath = (segment: string): string =>
  `${apiBaseUrl}/${segment}`;

export const gatewayPath = (segment: string): string =>
  `${gatewayBaseUrl}/${segment}`;
