import { environment } from '../../environments/environment';

export const SERVICE_NAME = 'ddm';
export const API_VERSION = '1';
export const API_VERSION_HEADER = 'x-api-version';

export const apiBaseUrl = `${environment.apiUrl}/${SERVICE_NAME}`;

export const apiPath = (segment: string): string =>
  `${apiBaseUrl}/${segment}`;
