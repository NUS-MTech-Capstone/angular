import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, RouterLink, NzAlertModule, NzSpinModule],
  templateUrl: './auth-callback.html',
  styleUrls: ['./auth-callback.css'],
})
export class AuthCallback implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cd = inject(ChangeDetectorRef);

  error?: string;

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      this.error = params.get('error_description') || 'Missing authorization code in callback.';
      this.cd.detectChanges();
      return;
    }

    try {
      await this.auth.handleCallback(code, state);
      this.router.navigate(['/access']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Sign-in failed.';
      this.cd.detectChanges();
    }
  }
}
