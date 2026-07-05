import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_VERSION, API_VERSION_HEADER, apiBaseUrl } from '../core/api.constants';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isPlatformRequest =
    req.url.startsWith(apiBaseUrl) ||
    req.url.startsWith('/sessions') ||
    req.url.startsWith('/incidents') ||
    req.url.startsWith('/alerts');
  const headers: Record<string, string> = {};

  if (isPlatformRequest) {
    headers['X-Request-ID'] = crypto.randomUUID();
  }

  if (req.url.startsWith(apiBaseUrl)) {
    headers[API_VERSION_HEADER] = API_VERSION;
    if (auth.authMode === 'dev' && auth.accessToken) {
      headers['Authorization'] = `Bearer ${auth.accessToken}`;
    }
  }

  const request =
    Object.keys(headers).length > 0
      ? req.clone({ setHeaders: headers })
      : req;

  return next(request).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        req.url.startsWith(apiBaseUrl) &&
        !req.url.includes('/auth/dev-login')
      ) {
        auth.clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
