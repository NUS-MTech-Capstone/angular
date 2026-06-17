import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface MonitoringStatus {
  configured: boolean;
  region?: string;
  logGroup?: string;
  sessionLogGroup?: string;
}

export interface AlarmSummary {
  name: string;
  state: 'ALARM' | 'OK' | 'INSUFFICIENT_DATA';
  description?: string;
  metric: string;
  namespace: string;
  threshold?: number;
  updatedAt: string;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface MetricSummary {
  name: string;
  namespace: string;
  unit: string;
  dataPoints: MetricDataPoint[];
  current?: number;
}

export interface LogEvent {
  timestamp: string;
  message: string;
  logStream: string;
}

export interface AlertEvent {
  id: string;
  alarmName: string;
  state: string;
  description?: string;
  metric: string;
  source: string;
  triggeredAt: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class MonitoringService {
  private http = inject(HttpClient);
  private base = '/ddm/monitoring';

  getStatus(): Observable<MonitoringStatus> {
    return this.http.get<MonitoringStatus>(`${this.base}/status`);
  }

  getAlarms(): Observable<AlarmSummary[]> {
    return this.http.get<AlarmSummary[]>(`${this.base}/alarms`);
  }

  getMetrics(metric: string, namespace?: string, hours = 24): Observable<MetricSummary> {
    const params: Record<string, string> = { metric, hours: String(hours) };
    if (namespace) params['namespace'] = namespace;
    return this.http.get<MetricSummary>(`${this.base}/metrics`, { params });
  }

  getAppLogs(limit = 100, filter?: string): Observable<LogEvent[]> {
    const params: Record<string, string> = { limit: String(limit) };
    if (filter) params['filter'] = filter;
    return this.http.get<LogEvent[]>(`${this.base}/logs/app`, { params });
  }

  getSessionLogs(limit = 100, filter?: string): Observable<LogEvent[]> {
    const params: Record<string, string> = { limit: String(limit) };
    if (filter) params['filter'] = filter;
    return this.http.get<LogEvent[]>(`${this.base}/logs/sessions`, { params });
  }

  getAlerts(limit = 50): Observable<AlertEvent[]> {
    return this.http.get<AlertEvent[]>(`${this.base}/alerts`, {
      params: { limit: String(limit) },
    });
  }
}
