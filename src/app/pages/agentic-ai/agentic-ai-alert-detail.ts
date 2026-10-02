import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { finalize } from 'rxjs/operators';
import {
  AlertStatus,
  CloudWatchState,
  IncidentAgentService,
  ManagedAlertDetail,
} from '../../services/incident-agent.service';

@Component({
  selector: 'app-agentic-ai-alert-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NzButtonModule,
    NzDescriptionsModule,
    NzIconModule,
    NzSpinModule,
    NzTagModule,
  ],
  templateUrl: './agentic-ai-alert-detail.html',
})
export class AgenticAiAlertDetail implements OnInit {
  alert?: ManagedAlertDetail;
  isLoading = false;
  private alertId = '';

  constructor(
    private incidentAgent: IncidentAgentService,
    private route: ActivatedRoute,
    private message: NzMessageService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.alertId = this.route.snapshot.paramMap.get('alertId') ?? '';
    if (this.alertId) {
      this.loadAlert();
    }
  }

  loadAlert(): void {
    if (!this.alertId || this.isLoading) {
      return;
    }
    this.isLoading = true;
    this.incidentAgent.getAlert(this.alertId).pipe(finalize(() => {
      this.isLoading = false;
      this.cd.detectChanges();
    })).subscribe({
      next: (alert) => {
        this.alert = alert;
      },
      error: (error: unknown) => this.message.error(this.errorMessage(error, 'Failed to load alert')),
    });
  }

  statusLabel(status: AlertStatus): string {
    return status.toLowerCase().replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase());
  }

  statusColor(status: AlertStatus): string {
    switch (status) {
      case 'RECEIVED':
      case 'TRIAGING':
      case 'EXECUTING': return 'blue';
      case 'TRIAGED':
      case 'RESOLVED': return 'green';
      case 'PENDING_APPROVAL': return 'gold';
      case 'REJECTED': return 'default';
      case 'FAILED': return 'red';
    }
  }

  cloudwatchColor(state: CloudWatchState): string {
    return state === 'ALARM' ? 'red' : 'green';
  }

  sshAuditParams(alert: ManagedAlertDetail): Record<string, string> {
    return {
      tab: 'ssh',
      hostId: alert.hostId,
      from: this.windowIso(alert.occurredAt, -30),
      to: this.windowIso(alert.occurredAt, 30),
    };
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    return error.status === 404 ? 'Alert not found' : error.error?.detail ?? error.message ?? fallback;
  }

  private windowIso(value: string, offsetMinutes: number): string {
    const date = new Date(value);
    const base = Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
    return new Date(base + offsetMinutes * 60 * 1000).toISOString();
  }
}
