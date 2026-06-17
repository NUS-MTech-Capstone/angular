import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  MonitoringService,
  MonitoringStatus,
  AlarmSummary,
  MetricSummary,
  LogEvent,
  AlertEvent,
} from './monitoring.service';
import { apiPath } from '../core/api.constants';

const BASE_URL = apiPath('monitoring');

describe('MonitoringService', () => {
  let service: MonitoringService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MonitoringService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MonitoringService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getStatus', () => {
    it('GETs /status', () => {
      const status: MonitoringStatus = { configured: true, region: 'ap-southeast-1' };
      let result: MonitoringStatus | undefined;

      service.getStatus().subscribe((r) => (result = r));

      const req = http.expectOne(`${BASE_URL}/status`);
      expect(req.request.method).toBe('GET');
      req.flush(status);

      expect(result).toEqual(status);
    });
  });

  describe('getAlarms', () => {
    it('GETs /alarms', () => {
      const alarms: AlarmSummary[] = [
        {
          name: 'HighCPU',
          state: 'ALARM',
          metric: 'CPUUtilization',
          namespace: 'AWS/EC2',
          updatedAt: '2026-06-18T00:00:00.000Z',
        },
      ];
      let result: AlarmSummary[] | undefined;

      service.getAlarms().subscribe((r) => (result = r));

      const req = http.expectOne(`${BASE_URL}/alarms`);
      expect(req.request.method).toBe('GET');
      req.flush(alarms);

      expect(result).toEqual(alarms);
    });
  });

  describe('getMetrics', () => {
    it('GETs /metrics with metric and hours params', () => {
      const metrics: MetricSummary = {
        name: 'RequestCount',
        namespace: 'DenDenMushi',
        unit: 'Count',
        dataPoints: [],
      };

      service.getMetrics('RequestCount', undefined, 6).subscribe();

      const req = http.expectOne((r) => r.url === `${BASE_URL}/metrics`);
      expect(req.request.params.get('metric')).toBe('RequestCount');
      expect(req.request.params.get('hours')).toBe('6');
      req.flush(metrics);
    });

    it('includes namespace param when provided', () => {
      service.getMetrics('ErrorCount', 'CustomNS', 24).subscribe();

      const req = http.expectOne((r) => r.url === `${BASE_URL}/metrics`);
      expect(req.request.params.get('namespace')).toBe('CustomNS');
      req.flush({ name: 'ErrorCount', namespace: 'CustomNS', unit: 'Count', dataPoints: [] });
    });
  });

  describe('getAppLogs', () => {
    it('GETs /logs/app with limit and filter', () => {
      const logs: LogEvent[] = [
        { timestamp: '2026-06-18T00:00:00.000Z', message: 'ERROR boom', logStream: 'stream-1' },
      ];

      service.getAppLogs(50, 'ERROR').subscribe();

      const req = http.expectOne((r) => r.url === `${BASE_URL}/logs/app`);
      expect(req.request.params.get('limit')).toBe('50');
      expect(req.request.params.get('filter')).toBe('ERROR');
      req.flush(logs);
    });
  });

  describe('getSessionLogs', () => {
    it('GETs /logs/sessions', () => {
      service.getSessionLogs(100).subscribe();

      const req = http.expectOne((r) => r.url === `${BASE_URL}/logs/sessions`);
      expect(req.request.params.get('limit')).toBe('100');
      req.flush([]);
    });
  });

  describe('getAlerts', () => {
    it('GETs /alerts with limit param', () => {
      const alerts: AlertEvent[] = [
        {
          id: 'alert-1',
          alarmName: 'HighCPU',
          state: 'ALARM',
          metric: 'CPUUtilization',
          source: 'cloudwatch',
          triggeredAt: '2026-06-18T00:00:00.000Z',
          createdAt: '2026-06-18T00:00:01.000Z',
        },
      ];
      let result: AlertEvent[] | undefined;

      service.getAlerts(25).subscribe((r) => (result = r));

      const req = http.expectOne((r) => r.url === `${BASE_URL}/alerts`);
      expect(req.request.params.get('limit')).toBe('25');
      req.flush(alerts);

      expect(result).toEqual(alerts);
    });
  });
});
