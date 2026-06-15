import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from './auth/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/access' },
  {
    path: 'login',
    data: { title: 'Login' },
    loadChildren: () => import('./pages/login/login.routes').then((m) => m.LOGIN_ROUTES),
  },
  {
    path: 'profile',
    data: { title: 'Profile' },
    canActivate: [authGuard],
    loadChildren: () => import('./pages/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
  },
  {
    path: 'access',
    data: { title: 'Access' },
    canActivate: [authGuard, permissionGuard('access.view')],
    loadChildren: () => import('./pages/access/access.routes').then((m) => m.ACCESS_ROUTES),
  },
  {
    path: 'terminal',
    data: { title: 'SSH Terminal' },
    canActivate: [authGuard, permissionGuard('access.view')],
    loadChildren: () => import('./pages/terminal/terminal.routes').then((m) => m.TERMINAL_ROUTES),
  },
  {
    path: 'change-management',
    data: { title: 'Change Management' },
    canActivate: [authGuard, permissionGuard('change.view')],
    loadChildren: () => import('./pages/change-management/change-management.routes').then((m) => m.CHANGE_MANAGEMENT_ROUTES),
  },
  {
    path: 'inventory',
    data: { title: 'Inventory' },
    canActivate: [authGuard, permissionGuard('inventory.view')],
    loadChildren: () => import('./pages/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
  },
  {
    path: 'identity',
    data: { title: 'Identity' },
    canActivate: [authGuard, permissionGuard('identity.users.manage')],
    loadChildren: () => import('./pages/identity/identity.routes').then((m) => m.IDENTITY_ROUTES),
  },
];
