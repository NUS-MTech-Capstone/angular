import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { apiPath } from '../core/api.constants';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
    service.clearSession();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    service.clearSession();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch auth config from the ddm auth/config path', async () => {
    const configPromise = service.getAuthConfig();

    const req = httpMock.expectOne(apiPath('auth/config'));
    expect(req.request.method).toBe('GET');
    req.flush({ mode: 'dev', devUsers: [] });

    const config = await configPromise;
    expect(config.mode).toBe('dev');
    expect(config.devUsers).toEqual([]);
  });

  it('should report unauthenticated when no access token is stored', () => {
    expect(service.isAuthenticated).toBe(false);
  });

  it('devLogin stores the token and loads the profile', async () => {
    const loginPromise = service.devLogin('employee.dev');

    httpMock
      .expectOne(apiPath('auth/dev-login'))
      .flush({ accessToken: 'dev-token' });

    await Promise.resolve();

    httpMock.expectOne(apiPath('auth/me')).flush({
      sub: 'dev-employee.dev',
      username: 'employee.dev',
      roles: ['Employee'],
      permissions: ['access.view'],
    });

    await loginPromise;

    expect(localStorage.getItem('ddm.accessToken')).toBe('dev-token');
    expect(service.isAuthenticated).toBe(true);
    expect(service.user()?.username).toBe('employee.dev');
  });

  it('loadProfile caches concurrent callers through ensureProfileLoaded', async () => {
    const profile = {
      sub: '1',
      username: 'alice',
      roles: ['Employee'],
      permissions: ['access.view'],
    };

    const first = service.ensureProfileLoaded();
    const second = service.ensureProfileLoaded();

    httpMock.expectOne(apiPath('auth/me')).flush(profile);

    await expect(first).resolves.toEqual(profile);
    await expect(second).resolves.toEqual(profile);
    expect(service.user()).toEqual(profile);
  });

  it('hasPermission reads from the loaded profile', async () => {
    const profilePromise = service.loadProfile();
    httpMock.expectOne(apiPath('auth/me')).flush({
      sub: '1',
      username: 'alice',
      roles: ['Employee'],
      permissions: ['inventory.view'],
    });
    await profilePromise;

    expect(service.hasPermission('inventory.view')).toBe(true);
    expect(service.hasPermission('inventory.manage')).toBe(false);
  });

  it('logout clears dev session and navigates to login', () => {
    localStorage.setItem('ddm.accessToken', 'dev-token');

    service.logout();

    expect(localStorage.getItem('ddm.accessToken')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('loginWithAlb navigates to the backend login endpoint', () => {
    const originalLocation = window.location;
    const locationMock = { href: '' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationMock,
    });

    service.loginWithAlb();

    expect(locationMock.href).toBe(apiPath('auth/login'));

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
