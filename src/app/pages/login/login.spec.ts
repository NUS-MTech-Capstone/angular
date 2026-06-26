import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authService: {
    isAuthenticated: boolean;
    getAuthConfig: ReturnType<typeof vi.fn>;
    devLogin: ReturnType<typeof vi.fn>;
    loginWithAlb: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      isAuthenticated: false,
      getAuthConfig: vi.fn().mockResolvedValue({
        mode: 'dev',
        devUsers: [{ username: 'admin.dev', name: 'Kei Yam', roles: ['Admin'] }],
      }),
      devLogin: vi.fn().mockResolvedValue(undefined),
      loginWithAlb: vi.fn(),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load dev auth config on init in dev mode', () => {
    expect(authService.getAuthConfig).toHaveBeenCalled();
    expect(component.devUsers).toEqual([
      { username: 'admin.dev', name: 'Kei Yam', roles: ['Admin'] },
    ]);
  });

  it('redirects authenticated users to Access', async () => {
    authService.isAuthenticated = true;
    authService.getAuthConfig.mockClear();

    await component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/access']);
    expect(authService.getAuthConfig).not.toHaveBeenCalled();
  });

  it('shows a backend error when auth config cannot be loaded', async () => {
    authService.getAuthConfig.mockRejectedValue(new Error('network down'));

    await component.ngOnInit();

    expect(component.error).toContain('Could not reach the backend');
  });

  it('signs in with a dev user and navigates to Access', async () => {
    await component.signInAs('admin.dev');

    expect(authService.devLogin).toHaveBeenCalledWith('admin.dev');
    expect(router.navigate).toHaveBeenCalledWith(['/access']);
    expect(component.loadingUser).toBeUndefined();
  });

  it('shows an error when dev login fails', async () => {
    authService.devLogin.mockRejectedValue(new Error('401'));

    await component.signInAs('admin.dev');

    expect(component.error).toBe(
      'Dev login failed. Check that the backend is running.',
    );
  });

  it('delegates ALB login to the auth service', () => {
    component.loginWithAlb();

    expect(authService.loginWithAlb).toHaveBeenCalled();
  });
});
