import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { Subject } from 'rxjs';
import {
  MonitoringService,
  AlarmSummary,
  AlertEvent,
  LogEvent,
  MetricSummary,
  MonitoringStatus,
} from '../../services/monitoring.service';
import { AuthService } from '../../services/auth.service';

interface PredefinedMetric {
  label: string;
  metric: string;
  icon: string;
  unit: string;
}

const PREDEFINED_METRICS: PredefinedMetric[] = [
  { label: 'Request Count', metric: 'RequestCount', icon: 'dashboard', unit: 'req' },
  { label: 'Error Count', metric: 'ErrorCount', icon: 'warning', unit: 'err' },
  { label: 'Active Sessions', metric: 'ActiveSessions', icon: 'safety', unit: '' },
  { label: 'Avg Response Time', metric: 'ResponseTime', icon: 'clock-circle', unit: 'ms' },
];

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTooltipModule,
  ],
  templateUrl: './monitoring.html',
  styleUrl: './monitoring.css',
})
export class Monitoring implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  status: MonitoringStatus = { configured: false };
  isLoading = false;

  // Alerts tab
  alarms: AlarmSummary[] = [];
  recentAlerts: AlertEvent[] = [];
  isLoadingAlarms = false;

  // Metrics tab
  metricSummaries: (MetricSummary & { label: string; icon: string })[] = [];
  isLoadingMetrics = false;
  selectedHours = 24;

  // App Logs tab
  appLogs: LogEvent[] = [];
  appLogFilter = '';
  isLoadingAppLogs = false;

  // Session Logs tab
  sessionLogs: LogEvent[] = [];
  sessionLogFilter = '';
  isLoadingSessionLogs = false;

  constructor(
    private monitoring: MonitoringService,
    private auth: AuthService,
    private message: NzMessageService,
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  can(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  private loadStatus(): void {
    this.monitoring.getStatus().subscribe({
      next: (s) => {
        this.status = s;
        this.loadAlarms();
        this.loadRecentAlerts();
        if (this.can('monitoring.view')) {
          this.loadMetrics();
          this.loadAppLogs();
        }
        if (this.can('monitoring.sessions')) {
          this.loadSessionLogs();
        }
      },
      error: () => {
        this.status = { configured: false };
      },
    });
  }

  // ── Alarms & Alerts ──────────────────────────────────────────────────────

  private refreshAuthorizationStatus(): void {
    this.monitoring.getStatus().subscribe({
      next: (s) => {
        this.status = s;
      },
    });
  }

  loadAlarms(): void {
    if (!this.can('monitoring.view')) return;
    this.isLoadingAlarms = true;
    this.monitoring.getAlarms().subscribe({
      next: (data) => {
        this.alarms = data;
        this.isLoadingAlarms = false;
        this.refreshAuthorizationStatus();
      },
      error: (err) => {
        this.isLoadingAlarms = false;
        this.refreshAuthorizationStatus();
        this.message.error(`Failed to load alarms: ${err?.message ?? 'Unknown error'}`);
      },
    });
  }

  loadRecentAlerts(): void {
    if (!this.can('monitoring.view')) return;
    this.monitoring.getAlerts().subscribe({
      next: (data) => (this.recentAlerts = data),
      error: () => {},
    });
  }

  get alarmCounts(): { alarm: number; ok: number; insufficient: number } {
    return {
      alarm: this.alarms.filter((a) => a.state === 'ALARM').length,
      ok: this.alarms.filter((a) => a.state === 'OK').length,
      insufficient: this.alarms.filter((a) => a.state === 'INSUFFICIENT_DATA').length,
    };
  }

  alarmStateColor(state: string): string {
    switch (state) {
      case 'ALARM': return 'red';
      case 'OK': return 'green';
      default: return 'default';
    }
  }

  alertStateColor(state: string): string {
    switch (state.toUpperCase()) {
      case 'ALARM': return 'red';
      case 'OK': return 'green';
      default: return 'orange';
    }
  }

  // ── Metrics ──────────────────────────────────────────────────────────────

  loadMetrics(): void {
    if (!this.can('monitoring.view')) return;
    this.isLoadingMetrics = true;
    this.metricSummaries = [];
    let pending = PREDEFINED_METRICS.length;

    PREDEFINED_METRICS.forEach((pm) => {
      this.monitoring.getMetrics(pm.metric, undefined, this.selectedHours).subscribe({
        next: (data) => {
          this.metricSummaries.push({ ...data, label: pm.label, icon: pm.icon });
          pending--;
          if (pending === 0) {
            this.isLoadingMetrics = false;
            this.refreshAuthorizationStatus();
          }
        },
        error: () => {
          pending--;
          if (pending === 0) {
            this.isLoadingMetrics = false;
            this.refreshAuthorizationStatus();
          }
        },
      });
    });
  }

  onHoursChange(): void {
    this.loadMetrics();
  }

  sparklinePath(dataPoints: { value: number }[], width = 120, height = 36): string {
    if (dataPoints.length < 2) return '';
    const max = Math.max(...dataPoints.map((d) => d.value), 1);
    const step = width / (dataPoints.length - 1);
    return dataPoints
      .map((d, i) => {
        const x = i * step;
        const y = height - (d.value / max) * height;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }

  // ── Application Logs ─────────────────────────────────────────────────────

  loadAppLogs(): void {
    if (!this.can('monitoring.view')) return;
    this.isLoadingAppLogs = true;
    this.monitoring.getAppLogs(100, this.appLogFilter || undefined).subscribe({
      next: (data) => {
        this.appLogs = data;
        this.isLoadingAppLogs = false;
      },
      error: (err) => {
        this.isLoadingAppLogs = false;
        this.message.error(`Failed to load application logs: ${err?.message ?? 'Unknown error'}`);
      },
    });
  }

  searchAppLogs(): void {
    this.loadAppLogs();
  }

  logLevelFromMessage(message: string): string {
    const m = message.toUpperCase();
    if (m.includes('ERROR') || m.includes('CRITICAL') || m.includes('FATAL')) return 'error';
    if (m.includes('WARN')) return 'warn';
    if (m.includes('DEBUG')) return 'debug';
    return 'info';
  }

  logLevelColor(level: string): string {
    switch (level) {
      case 'error': return 'red';
      case 'warn': return 'orange';
      case 'debug': return 'purple';
      default: return 'blue';
    }
  }

  // ── Session Logs ─────────────────────────────────────────────────────────

  loadSessionLogs(): void {
    if (!this.can('monitoring.sessions')) return;
    this.isLoadingSessionLogs = true;
    this.monitoring.getSessionLogs(100, this.sessionLogFilter || undefined).subscribe({
      next: (data) => {
        this.sessionLogs = data;
        this.isLoadingSessionLogs = false;
      },
      error: (err) => {
        this.isLoadingSessionLogs = false;
        this.message.error(`Failed to load session logs: ${err?.message ?? 'Unknown error'}`);
      },
    });
  }

  searchSessionLogs(): void {
    this.loadSessionLogs();
  }

  refreshAll(): void {
    this.loadAlarms();
    this.loadRecentAlerts();
    if (this.can('monitoring.view')) {
      this.loadMetrics();
      this.loadAppLogs();
    }
    if (this.can('monitoring.sessions')) {
      this.loadSessionLogs();
    }
    this.message.success('Refreshed');
  }
}
