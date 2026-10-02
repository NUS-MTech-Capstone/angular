import { Component, inject } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  link: string | null;
  activePrefixes?: string[];
  permission?: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterOutlet,
    NzAvatarModule,
    NzDropDownModule,
    NzIconModule,
    NzLayoutModule,
    NzTagModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private router = inject(Router);
  auth = inject(AuthService);

  isTerminalRoute = false;
  isAuthPage = false;
  currentPath = '';

  navItems: NavItem[] = [
    { label: 'Access', icon: 'safety', link: '/access', permission: 'access.view' },
    { label: 'Resources', icon: 'cluster', link: '/inventory', permission: 'inventory.view' },
    { label: 'Change Management', icon: 'file-sync', link: '/change-management', permission: 'change.view' },
    { label: 'Agentic AI', icon: 'robot', link: '/agentic-ai/incidents', activePrefixes: ['/agentic-ai'] },
    { label: 'Audit', icon: 'audit', link: '/audit', activePrefixes: ['/audit', '/session-audit'], permission: 'session-audit.view' },
    { label: 'Identity', icon: 'idcard', link: '/identity', permission: 'identity.users.view' },
  ];

  constructor() {
    this.updateRouteState(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateRouteState((event as NavigationEnd).urlAfterRedirects);
      });
  }

  canShow(item: NavItem): boolean {
    if (!item.link) {
      return true;
    }
    return !item.permission || this.auth.hasPermission(item.permission);
  }

  isNavItemActive(item: NavItem): boolean {
    if (!item.link) {
      return false;
    }
    return (item.activePrefixes ?? [item.link]).some(
      (prefix) => this.currentPath === prefix || this.currentPath.startsWith(`${prefix}/`),
    );
  }

  get displayName(): string {
    const user = this.auth.user();
    return user?.name || user?.username || '';
  }

  get avatarInitial(): string {
    return this.displayName.charAt(0).toUpperCase() || '?';
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.auth.logout();
  }

  private updateRouteState(url: string): void {
    this.currentPath = url.split(/[?#]/, 1)[0] || '/';
    this.isTerminalRoute = this.currentPath.startsWith('/terminal');
    this.isAuthPage = this.currentPath.startsWith('/login') || this.currentPath.startsWith('/auth/');
  }
}
