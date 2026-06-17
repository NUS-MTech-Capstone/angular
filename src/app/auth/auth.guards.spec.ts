import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard, permissionGuard } from './auth.guards';
import { AuthService } from '../services/auth.service';

describe('auth guards', () => {
  let auth: {
    authMode: 'dev' | 'alb';
    isAuthenticated: boolean;
    ensureProfileLoaded: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
  };
  let router: { createUrlTree: ReturnType<typeof vi.fn> };
  let loginTree: UrlTree;
  let profileTree: UrlTree;

  beforeEach(() => {
    loginTree = {} as UrlTree;
    profileTree = {} as UrlTree;
    auth = {
      authMode: 'dev',
      isAuthenticated: false,
      ensureProfileLoaded: vi.fn(),
      clearSession: vi.fn(),
      hasPermission: vi.fn(),
    };
    router = {
      createUrlTree: vi.fn((commands: string[]) =>
        commands[0] === '/profile' ? profileTree : loginTree,
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('authGuard redirects unauthenticated dev users to login', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );

    expect(result).toBe(loginTree);
    expect(auth.ensureProfileLoaded).not.toHaveBeenCalled();
  });

  it('authGuard loads the profile for alb users without a stored token', async () => {
    auth.authMode = 'alb';
    auth.ensureProfileLoaded.mockResolvedValue({
      username: 'alice',
      roles: ['Employee'],
      permissions: [],
    });

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );

    expect(result).toBe(true);
    expect(auth.ensureProfileLoaded).toHaveBeenCalled();
  });

  it('authGuard clears the session when profile loading fails', async () => {
    auth.isAuthenticated = true;
    auth.ensureProfileLoaded.mockRejectedValue(new Error('401'));

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );

    expect(auth.clearSession).toHaveBeenCalled();
    expect(result).toBe(loginTree);
  });

  it('permissionGuard sends users without permission to profile', async () => {
    auth.isAuthenticated = true;
    auth.ensureProfileLoaded.mockResolvedValue({
      username: 'alice',
      roles: ['Employee'],
      permissions: [],
    });
    auth.hasPermission.mockReturnValue(false);

    const guard = permissionGuard('inventory.manage');
    const result = await TestBed.runInInjectionContext(() =>
      guard({} as never, {} as never),
    );

    expect(auth.hasPermission).toHaveBeenCalledWith('inventory.manage');
    expect(result).toBe(profileTree);
  });

  it('permissionGuard allows users with the required permission', async () => {
    auth.isAuthenticated = true;
    auth.ensureProfileLoaded.mockResolvedValue({
      username: 'alice',
      roles: ['Admin'],
      permissions: ['inventory.manage'],
    });
    auth.hasPermission.mockReturnValue(true);

    const guard = permissionGuard('inventory.manage');
    const result = await TestBed.runInInjectionContext(() =>
      guard({} as never, {} as never),
    );

    expect(result).toBe(true);
  });
});
