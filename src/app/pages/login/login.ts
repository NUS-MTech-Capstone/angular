import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { environment } from '../../../environments/environment';
import { AuthService, DevUserOption } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, NzAlertModule, NzButtonModule, NzCardModule, NzIconModule, NzTagModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private cd = inject(ChangeDetectorRef);

  mode = environment.auth.mode;
  devUsers: DevUserOption[] = [];
  loadingUser?: string;
  error?: string;

  async ngOnInit(): Promise<void> {
    if (this.auth.isAuthenticated) {
      this.router.navigate(['/access']);
      return;
    }

    if (this.mode === 'dev') {
      try {
        const config = await this.auth.getAuthConfig();
        this.devUsers = config.devUsers;
      } catch {
        this.error = 'Could not reach the backend. Is the API running on ' + environment.apiUrl + '?';
      }
      this.cd.detectChanges();
    }
  }

  async signInAs(username: string): Promise<void> {
    this.loadingUser = username;
    this.error = undefined;
    try {
      await this.auth.devLogin(username);
      this.router.navigate(['/access']);
    } catch {
      this.error = 'Dev login failed. Check that the backend is running.';
    } finally {
      this.loadingUser = undefined;
      this.cd.detectChanges();
    }
  }

  loginWithAlb(): void {
    this.auth.loginWithAlb();
  }
}
