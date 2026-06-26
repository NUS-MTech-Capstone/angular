import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import {
  AlarmSummary,
  AlertEvent,
  LogEvent,
  MetricSummary,
  MonitoringService,
  MonitoringStatus,
} from '../../services/monitoring.service';
import { AuthService } from '../../services/auth.service';
import { Monitoring } from './monitoring';

describe('Monitoring', () => {
  let component: Monitoring;
  let fixture: ComponentFixture<Monitoring>;
  let monitoringService: {
    getStatus: ReturnType<typeof vi.fn>;
    getAlarms: ReturnType<typeof vi.fn>;
    getAlerts: ReturnType<typeof vi.fn>;
    getMetrics: ReturnType<typeof vi.fn>;
    getAppLogs: ReturnType<typeof vi.fn>;
    getSessionLogs: ReturnType<typeof vi.fn>;
  };
  let authService: { hasPermission: ReturnType<typeof vi.fn> };
  let message: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  const status: MonitoringStatus = {
    configured: true,
    region: 'ap-southeast-1',
    awsAuthorized: true,
  };

  beforeEach(async () => {
    monitoringService = {
      getStatus: vi.fn(() => of(status)),
      getAlarms: vi.fn(() => of([] as AlarmSummary[])),
      getAlerts: vi.fn(() => of([] as AlertEvent[])),
      getMetrics: vi.fn(() =>
        of({
          name: 'RequestCount',
          namespace: 'DenDenMushi',
          unit: 'Count',
          dataPoints: [{ timestamp: '2026-06-18T00:00:00.000Z', value: 1 }],
          current: 1,
        } as MetricSummary),
      ),
      getAppLogs: vi.fn(() => of([] as LogEvent[])),
      getSessionLogs: vi.fn(() => of([] as LogEvent[])),
    };
    authService = {
      hasPermission: vi.fn((permission: string) =>
        permission === 'monitoring.view' || permission === 'monitoring.sessions',
      ),
    };
    message = {
      error: vi.fn(),
      success: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Monitoring],
      providers: [
        provideNzIcons(icons),
        { provide: MonitoringService, useValue: monitoringService },
        { provide: AuthService, useValue: authService },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Monitoring);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads status and monitoring data on init when permitted', () => {
    expect(monitoringService.getStatus).toHaveBeenCalled();
    expect(monitoringService.getAlarms).toHaveBeenCalled();
    expect(monitoringService.getAlerts).toHaveBeenCalled();
    expect(monitoringService.getMetrics).toHaveBeenCalled();
    expect(monitoringService.getAppLogs).toHaveBeenCalled();
    expect(monitoringService.getSessionLogs).toHaveBeenCalled();
  });

  it('counts alarm states', () => {
    component.alarms = [
      { name: 'a1', state: 'ALARM' } as AlarmSummary,
      { name: 'a2', state: 'OK' } as AlarmSummary,
      { name: 'a3', state: 'INSUFFICIENT_DATA' } as AlarmSummary,
    ];

    expect(component.alarmCounts).toEqual({ alarm: 1, ok: 1, insufficient: 1 });
  });

  it('maps alarm and alert state colors', () => {
    expect(component.alarmStateColor('ALARM')).toBe('red');
    expect(component.alarmStateColor('OK')).toBe('green');
    expect(component.alertStateColor('alarm')).toBe('red');
    expect(component.alertStateColor('unknown')).toBe('orange');
  });

  it('builds sparkline paths from metric datapoints', () => {
    const path = component.sparklinePath([
      { value: 0 },
      { value: 10 },
      { value: 5 },
    ]);

    expect(path).toMatch(/^M 0\.0 /);
    expect(path).toContain('L');
  });

  it('returns an empty sparkline path for fewer than two points', () => {
    expect(component.sparklinePath([{ value: 1 }])).toBe('');
  });

  it('derives log levels from message text', () => {
    expect(component.logLevelFromMessage('ERROR failed to connect')).toBe('error');
    expect(component.logLevelFromMessage('WARN retrying')).toBe('warn');
    expect(component.logLevelFromMessage('DEBUG trace')).toBe('debug');
    expect(component.logLevelFromMessage('started ok')).toBe('info');
  });

  it('maps log level colors', () => {
    expect(component.logLevelColor('error')).toBe('red');
    expect(component.logLevelColor('warn')).toBe('orange');
    expect(component.logLevelColor('info')).toBe('blue');
  });

  it('shows an error when alarm loading fails', () => {
    monitoringService.getAlarms.mockReturnValue(
      throwError(() => new Error('CloudWatch unavailable')),
    );

    component.loadAlarms();

    expect(message.error).toHaveBeenCalledWith(
      'Failed to load alarms: CloudWatch unavailable',
    );
  });

  it('skips protected loads when permissions are missing', async () => {
    monitoringService.getAlarms.mockClear();
    monitoringService.getMetrics.mockClear();
    monitoringService.getSessionLogs.mockClear();
    authService.hasPermission.mockReturnValue(false);

    const restrictedFixture = TestBed.createComponent(Monitoring);
    const restricted = restrictedFixture.componentInstance;
    monitoringService.getAlarms.mockClear();
    monitoringService.getMetrics.mockClear();
    monitoringService.getSessionLogs.mockClear();
    restricted.loadAlarms();
    restricted.loadMetrics();
    restricted.loadSessionLogs();

    expect(monitoringService.getAlarms).not.toHaveBeenCalled();
    expect(monitoringService.getMetrics).not.toHaveBeenCalled();
    expect(monitoringService.getSessionLogs).not.toHaveBeenCalled();
  });

  it('refreshAll reloads visible tabs and shows success', () => {
    monitoringService.getAlarms.mockClear();
    monitoringService.getAlerts.mockClear();

    component.refreshAll();

    expect(monitoringService.getAlarms).toHaveBeenCalled();
    expect(monitoringService.getAlerts).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith('Refreshed');
  });
});
