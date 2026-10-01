import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { AuthService } from './services/auth.service';
import { App } from './app';
import { icons } from './icons-provider';

describe('App', () => {
  let auth: {
    user: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    auth = {
      user: vi.fn(() => ({ username: 'testuser', name: 'Test User' })),
      hasPermission: vi.fn(() => true),
      logout: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders navigation and executes profile, permission, identity and logout behavior', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('DenDenMushi');
    expect(app.displayName).toBe('Test User');
    expect(app.avatarInitial).toBe('T');
    expect(app.canShow(app.navItems[0])).toBe(true);
    auth.hasPermission.mockReturnValue(false);
    expect(app.canShow(app.navItems[0])).toBe(false);

    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    app.goToProfile();
    expect(navigate).toHaveBeenCalledWith(['/profile']);
    app.logout();
    expect(auth.logout).toHaveBeenCalled();

    auth.user.mockReturnValue({ username: 'fallback-user', name: '' });
    expect(app.displayName).toBe('fallback-user');
    auth.user.mockReturnValue(null);
    expect(app.avatarInitial).toBe('?');

    app.currentPath = '/agentic-ai/incidents';
    expect(app.isNavItemActive(app.navItems[3])).toBe(true);
    expect(app.isNavItemActive(app.navItems[4])).toBe(false);

    app.currentPath = '/audit';
    expect(app.isNavItemActive(app.navItems[4])).toBe(true);
    app.currentPath = '/session-audit';
    expect(app.isNavItemActive(app.navItems[4])).toBe(true);
  });
});
