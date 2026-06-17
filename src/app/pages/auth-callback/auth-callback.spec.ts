import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthCallback } from './auth-callback';

describe('AuthCallback', () => {
  let component: AuthCallback;
  let fixture: ComponentFixture<AuthCallback>;
  let authService: {
    authMode: 'dev' | 'alb';
    ensureProfileLoaded: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      authMode: 'dev',
      ensureProfileLoaded: vi.fn(),
    };
    router = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [AuthCallback],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthCallback);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('redirects to login in dev mode', () => {
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('redirects to access when alb profile load succeeds', async () => {
    router.navigate.mockClear();
    authService.authMode = 'alb';
    authService.ensureProfileLoaded.mockResolvedValue({ username: 'alice' });

    fixture = TestBed.createComponent(AuthCallback);
    component = fixture.componentInstance;
    await component.ngOnInit();

    expect(authService.ensureProfileLoaded).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/access']);
  });
});
