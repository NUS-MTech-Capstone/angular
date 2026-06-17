import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, NzSpinModule],
  templateUrl: './auth-callback.html',
  styleUrls: ['./auth-callback.css'],
})
export class AuthCallback implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    if (this.auth.authMode === 'alb') {
      try {
        await this.auth.ensureProfileLoaded();
        await this.router.navigate(['/access']);
        return;
      } catch {
        // Fall through to login when the ALB session is not established yet.
      }
    }

    await this.router.navigate(['/login']);
  }
}
