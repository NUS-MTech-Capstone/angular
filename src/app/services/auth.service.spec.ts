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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
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
});
