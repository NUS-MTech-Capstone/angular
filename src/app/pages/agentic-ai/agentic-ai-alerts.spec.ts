import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import { IncidentAgentService } from '../../services/incident-agent.service';
import { AgenticAiAlerts } from './agentic-ai-alerts';
import { alertFixture } from './agentic-ai.test-fixtures';

describe('AgenticAiAlerts', () => {
  let component: AgenticAiAlerts;
  let fixture: ComponentFixture<AgenticAiAlerts>;
  let incidentAgent: {
    listAlerts: ReturnType<typeof vi.fn>;
    getHealth: ReturnType<typeof vi.fn>;
  };
  let message: { error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    incidentAgent = {
      listAlerts: vi.fn(() => of({ alerts: [alertFixture()] })),
      getHealth: vi.fn(() => of({
        databaseReady: true,
        queueConsumerConfigured: true,
        queueConsumerRunning: true,
        lastAlertProcessedAt: '2026-01-01T00:00:00Z',
        lastErrorSummary: '',
        activeIncidentCount: 1,
        failedIncidentCount: 0,
      })),
    };
    message = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AgenticAiAlerts],
      providers: [
        provideNzIcons(icons),
        provideRouter([]),
        { provide: IncidentAgentService, useValue: incidentAgent },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgenticAiAlerts);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads supporting alert context and links to a dedicated detail page', () => {
    expect(component.alerts).toHaveLength(1);
    expect(component.health?.databaseReady).toBe(true);
    expect(component.pendingApprovalCount).toBe(1);
    expect(fixture.nativeElement.querySelector('a[href="/agentic-ai/alerts/alert-1"]')).not.toBeNull();
    expect((component as unknown as Record<string, unknown>)['isDrawerOpen']).toBeUndefined();
  });

  it('filters alerts by status, CloudWatch state, and host', () => {
    component.alerts = [
      alertFixture(),
      { ...alertFixture(), id: 'alert-2', status: 'RESOLVED', hostId: 'db-1', cloudwatchState: 'OK' },
    ];
    component.statusFilter = 'RESOLVED';
    component.cloudwatchFilter = 'OK';
    component.hostFilter = 'db';

    expect(component.filteredAlerts.map((alert) => alert.id)).toEqual(['alert-2']);
  });

  it('treats a null alert list as empty', () => {
    incidentAgent.listAlerts.mockReturnValueOnce(of({ alerts: null } as never));

    component.loadAlerts();

    expect(component.alerts).toEqual([]);
  });

  it('reports health errors without clearing alerts', () => {
    incidentAgent.getHealth.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503, error: { detail: 'service is not ready' } })),
    );

    component.loadHealth();

    expect(component.alerts).toHaveLength(1);
    expect(message.error).toHaveBeenCalledWith('service is not ready');
  });
});
