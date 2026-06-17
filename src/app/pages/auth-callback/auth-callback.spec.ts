import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthCallback } from './auth-callback';

describe('AuthCallback', () => {
  let component: AuthCallback;
  let fixture: ComponentFixture<AuthCallback>;
  let authService: { handleCallback: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      handleCallback: vi.fn().mockResolvedValue(undefined),
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AuthCallback],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: vi.fn((key: string) => {
                  const params: Record<string, string> = {
                    code: 'auth-code',
                    state: 'oauth-state',
                  };
                  return params[key] ?? null;
                }),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthCallback);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle OAuth callback and navigate to access', () => {
    expect(authService.handleCallback).toHaveBeenCalledWith(
      'auth-code',
      'oauth-state',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/access']);
  });
});
