import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { API_VERSION, API_VERSION_HEADER, apiPath } from '../core/api.constants';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: {
    authMode: 'dev' | 'alb';
    accessToken: string | null;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = {
      authMode: 'dev',
      accessToken: 'dev-token',
      clearSession: vi.fn(),
    };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('adds dev authorization and API version only to Nest APIs', () => {
    http.get(apiPath('auth/me')).subscribe();

    const request = httpMock.expectOne(apiPath('auth/me'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer dev-token');
    expect(request.request.headers.get(API_VERSION_HEADER)).toBe(API_VERSION);
    request.flush({});
  });

  it('does not add authorization in alb mode', () => {
    auth.authMode = 'alb';
    auth.accessToken = null;

    http.get(apiPath('auth/me')).subscribe();

    const request = httpMock.expectOne(apiPath('auth/me'));
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.get(API_VERSION_HEADER)).toBe(API_VERSION);
    request.flush({});
  });

  it('redirects to ALB login on 401 in alb mode', () => {
    auth.authMode = 'alb';
    const originalLocation = window.location;
    const locationMock = { href: '' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: locationMock,
    });

    http.get(apiPath('auth/me')).subscribe({ error: () => undefined });

    const request = httpMock.expectOne(apiPath('auth/me'));
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).toHaveBeenCalled();
    expect(locationMock.href).toBe(apiPath('auth/login'));

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
