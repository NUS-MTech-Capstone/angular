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
    loginWithSso: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      isAuthenticated: false,
      getAuthConfig: vi.fn().mockResolvedValue({ mode: 'dev', devUsers: [] }),
      devLogin: vi.fn().mockResolvedValue(undefined),
      loginWithSso: vi.fn(),
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
  });
});
