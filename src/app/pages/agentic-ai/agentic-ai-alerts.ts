import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AgentHealth,
  AlertStatus,
  CloudWatchState,
  IncidentAgentService,
  ManagedAlert,
  ManagedAlertDetail,
} from '../../services/incident-agent.service';

type AlertStatusFilter = 'ALL' | AlertStatus;
type CloudWatchStateFilter = 'ALL' | CloudWatchState;

const STATUS_FILTERS: { label: string; value: AlertStatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Triaging', value: 'TRIAGING' },
  { label: 'Triaged', value: 'TRIAGED' },
  { label: 'Pending approval', value: 'PENDING_APPROVAL' },
  { label: 'Executing', value: 'EXECUTING' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Failed', value: 'FAILED' },
];

@Component({
  selector: 'app-agentic-ai-alerts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './agentic-ai-alerts.html',
  styleUrl: './agentic-ai.css',
})
export class AgenticAiAlerts implements OnInit {
  readonly statusFilters = STATUS_FILTERS;

  alerts: ManagedAlert[] = [];
  health?: AgentHealth;
  selectedAlert?: ManagedAlertDetail;
  statusFilter: AlertStatusFilter = 'ALL';
  cloudwatchFilter: CloudWatchStateFilter = 'ALL';
  hostFilter = '';
  isLoading = false;
  isLoadingHealth = false;
  isLoadingDetail = false;
  isDrawerOpen = false;

  constructor(
    private incidentAgent: IncidentAgentService,
    private message: NzMessageService,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loadHealth();
    this.loadAlerts();
  }

  get filteredAlerts(): ManagedAlert[] {
    const host = this.hostFilter.trim().toLowerCase();
    return this.alerts.filter((alert) => {
      const statusMatches = this.statusFilter === 'ALL' || alert.status === this.statusFilter;
      const stateMatches = this.cloudwatchFilter === 'ALL' || alert.cloudwatchState === this.cloudwatchFilter;
      const hostMatches = !host || alert.hostId.toLowerCase().includes(host);
      return statusMatches && stateMatches && hostMatches;
    });
  }

  get activeCount(): number {
    return this.alerts.filter((alert) =>
      ['RECEIVED', 'TRIAGING', 'PENDING_APPROVAL', 'EXECUTING'].includes(alert.status),
    ).length;
  }

  get pendingApprovalCount(): number {
    return this.countByStatus('PENDING_APPROVAL');
  }

  get resolvedCount(): number {
    return this.countByStatus('RESOLVED');
  }

  get failedCount(): number {
    return this.countByStatus('FAILED');
  }

  loadAlerts(): void {
    this.isLoading = true;
    this.incidentAgent.listAlerts().subscribe({
      next: (response) => {
        this.alerts = response.alerts;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.message.error(this.errorMessage(error, 'Failed to load alerts'));
      },
    });
  }

  loadHealth(): void {
    this.isLoadingHealth = true;
    this.incidentAgent.getHealth().subscribe({
      next: (health) => {
        this.health = health;
        this.isLoadingHealth = false;
      },
      error: (error: unknown) => {
        this.isLoadingHealth = false;
        this.message.error(this.errorMessage(error, 'Failed to load agent health'));
      },
    });
  }

  openAlert(alert: ManagedAlert): void {
    this.isDrawerOpen = true;
    this.isLoadingDetail = true;
    this.incidentAgent.getAlert(alert.id).subscribe({
      next: (detail) => {
        this.selectedAlert = detail;
        this.replaceAlert(detail);
        this.isLoadingDetail = false;
      },
      error: (error: unknown) => {
        this.isLoadingDetail = false;
        this.message.error(this.errorMessage(error, 'Failed to load alert'));
      },
    });
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
  }

  statusColor(status: AlertStatus): string {
    switch (status) {
      case 'RECEIVED':
      case 'TRIAGING':
      case 'EXECUTING':
        return 'blue';
      case 'TRIAGED':
      case 'RESOLVED':
        return 'green';
      case 'PENDING_APPROVAL':
        return 'gold';
      case 'REJECTED':
        return 'default';
      case 'FAILED':
        return 'red';
    }
  }

  cloudwatchColor(state: CloudWatchState): string {
    return state === 'ALARM' ? 'red' : 'green';
  }

  healthColor(value: boolean): string {
    return value ? 'green' : 'red';
  }

  private replaceAlert(updated: ManagedAlert): void {
    const index = this.alerts.findIndex((alert) => alert.id === updated.id);
    if (index === -1) {
      this.alerts = [updated, ...this.alerts];
      return;
    }
    this.alerts = [
      ...this.alerts.slice(0, index),
      { ...this.alerts[index], ...updated },
      ...this.alerts.slice(index + 1),
    ];
  }

  private countByStatus(status: AlertStatus): number {
    return this.alerts.filter((alert) => alert.status === status).length;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 404) {
      return 'Alert not found';
    }
    return error.error?.detail ?? error.message ?? fallback;
  }
}
