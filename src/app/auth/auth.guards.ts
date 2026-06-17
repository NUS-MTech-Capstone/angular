import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated) {
    return router.createUrlTree(['/login']);
  }

  try {
    await auth.ensureProfileLoaded();
  } catch {
    auth.clearSession();
    return router.createUrlTree(['/login']);
  }

  return true;
};

export const permissionGuard =
  (permission: string): CanActivateFn =>
  async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated) {
      return router.createUrlTree(['/login']);
    }

    // Guards on the same route run concurrently, so wait for the profile
    // ourselves instead of relying on authGuard having finished first.
    try {
      await auth.ensureProfileLoaded();
    } catch {
      auth.clearSession();
      return router.createUrlTree(['/login']);
    }

    return auth.hasPermission(permission)
      ? true
      : router.createUrlTree(['/profile']);
  };
