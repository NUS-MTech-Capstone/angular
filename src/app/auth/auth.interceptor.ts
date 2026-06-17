import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_VERSION, API_VERSION_HEADER, apiBaseUrl, apiPath } from '../core/api.constants';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApiRequest = req.url.startsWith(apiBaseUrl);
  const headers: Record<string, string> = {};

  if (isApiRequest) {
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
        isApiRequest &&
        !req.url.includes('/auth/dev-login')
      ) {
        auth.clearSession();
        if (auth.authMode === 'alb') {
          window.location.href = apiPath('auth/login');
        } else {
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    }),
  );
};
