import { Component, inject } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
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
  permission?: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
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

  navItems: NavItem[] = [
    { label: 'Access', icon: 'safety', link: '/access', permission: 'access.view' },
    { label: 'Resources', icon: 'cluster', link: '/inventory', permission: 'inventory.view' },
    { label: 'Change Management', icon: 'file-sync', link: '/change-management', permission: 'change.view' },
    { label: 'Agentic AI', icon: 'robot', link: '/agentic-ai' },
    { label: 'Monitoring', icon: 'dashboard', link: '/monitoring', permission: 'monitoring.view' },
    { label: 'Identity', icon: 'idcard', link: '/identity', permission: 'identity.users.view' },
  ];

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        this.isTerminalRoute = url.startsWith('/terminal');
        this.isAuthPage = url.startsWith('/login') || url.startsWith('/auth/');
      });
  }

  canShow(item: NavItem): boolean {
    if (!item.link) {
      return true;
    }
    return !item.permission || this.auth.hasPermission(item.permission);
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
}
