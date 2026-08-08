import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { icons } from '../../icons-provider';
import { AuthService } from '../../services/auth.service';
import { IdentityService } from '../../services/identity.service';
import {
  IncidentAgentService,
  IncidentEvent,
  IncidentSummary,
  ManagedAlert,
} from '../../services/incident-agent.service';
import {
  AuditSessionSummary,
  SessionAuditRecord,
  SessionAuditService,
} from '../../services/session-audit.service';
import { SessionAudit } from './session-audit';

describe('SessionAudit rendered integration', () => {
  let fixture: ComponentFixture<SessionAudit>;
  let component: SessionAudit;

  const session: AuditSessionSummary = {
    sessionId: 'sess-rendered-integration-1',
    userId: 'user-1',
    hostId: 'host-1',
    crId: 'cr-101',
    connectionType: 'ssh',
    status: 'CLOSED',
    createdAt: '2026-07-06T01:00:00Z',
    lastAuditAt: '2026-07-06T01:05:00Z',
    recordCount: 4,
    truncated: true,
  };

  const records: SessionAuditRecord[] = [
    {
      sessionId: session.sessionId,
      userId: session.userId,
      hostId: session.hostId,
      crId: session.crId,
      recordType: 'session_event',
      sequence: 1,
      commandText: 'session started',
      createdAt: '2026-07-06T01:00:00Z',
      truncated: false,
      byteCount: 15,
    },
    {
      sessionId: session.sessionId,
      userId: session.userId,
      hostId: session.hostId,
      crId: session.crId,
      recordType: 'command',
      sequence: 2,
      commandId: 'cmd-1',
      commandText: 'systemctl status app',
      createdAt: '2026-07-06T01:01:00Z',
      truncated: false,
      byteCount: 20,
    },
    {
      sessionId: session.sessionId,
      userId: session.userId,
      hostId: session.hostId,
      crId: session.crId,
      recordType: 'output',
      sequence: 3,
      commandId: 'cmd-1',
      outputDataBase64: btoa('active (running)\n'),
      createdAt: '2026-07-06T01:01:01Z',
      truncated: true,
      byteCount: 17,
    },
    {
      sessionId: session.sessionId,
      userId: session.userId,
      hostId: session.hostId,
      crId: session.crId,
      recordType: 'control',
      sequence: 4,
      commandId: 'cmd-1',
      commandText: 'Ctrl-C',
      createdAt: '2026-07-06T01:02:00Z',
      truncated: false,
      byteCount: 0,
    },
  ];

  const event: IncidentEvent = {
    id: 'evt-1',
    incidentId: 'inc-1',
    alertId: 'alert-1',
    eventType: 'PlanApproved',
    actor: 'manager-1',
    message: 'Exact plan approved',
    metadata: { planHash: 'hash-1' },
    createdAt: '2026-07-06T01:03:00Z',
  };

  const alert: ManagedAlert = {
    id: 'alert-1',
    sourceId: 'alarm-1',
    sourceType: 'cloudwatch',
    alarmArn: 'arn:alarm',
    alarmName: 'High CPU',
    cloudwatchState: 'ALARM',
    hostId: 'host-1',
    reason: 'threshold crossed',
    status: 'PENDING_APPROVAL',
    groupKey: 'host-1',
    incidentId: 'inc-1',
    grouped: false,
    errorSummary: '',
    occurredAt: '2026-07-06T01:00:00Z',
    createdAt: '2026-07-06T01:00:00Z',
    updatedAt: '2026-07-06T01:03:00Z',
  };

  const incident: IncidentSummary = {
    id: 'inc-1',
    alarmName: 'High CPU',
    hostId: 'host-1',
    state: 'AWAITING_APPROVAL',
    reason: 'threshold crossed',
    runbookVersion: 'v1',
    planHash: 'hash-1',
    approvalDecision: '',
    createdAt: '2026-07-06T01:00:00Z',
    updatedAt: '2026-07-06T01:03:00Z',
  };

  beforeEach(async () => {
    const sessionAudit = {
      listSessions: vi.fn(() => of({ sessions: [session], nextCursor: 'sessions-next' })),
      listAuditRecords: vi.fn(() => of({ records, nextCursor: 'records-next' })),
      listRecords: vi.fn(() => of({ records, nextCursor: 'timeline-next' })),
    };
    const incidentAgent = {
      listEvents: vi.fn(() => of({ events: [event], nextCursor: 'events-next' })),
      listAlerts: vi.fn(() => of({ alerts: [alert], nextCursor: 'alerts-next' })),
      list: vi.fn(() => of({ incidents: [incident], nextCursor: 'incidents-next' })),
    };

    await TestBed.configureTestingModule({
      imports: [SessionAudit],
      providers: [
        provideNzIcons(icons),
        { provide: SessionAuditService, useValue: sessionAudit },
        { provide: IncidentAgentService, useValue: incidentAgent },
        { provide: IdentityService, useValue: { listUsers: vi.fn(() => of([{ sub: 'user-1', username: 'alice', name: 'Alice Admin', enabled: true, status: 'CONFIRMED', roles: [] }])) } },
        { provide: AuthService, useValue: { hasPermission: vi.fn(() => true) } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: vi.fn(() => null) } } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionAudit);
    component = fixture.componentInstance;
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);
  });

  it('renders the SSH session list, selected timeline, filters, output and pagination states', async () => {
    expect(fixture.nativeElement.textContent).toContain('Alice Admin');
    component.selectSession(session);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Timeline');
    expect(text).toContain('systemctl status app');
    expect(text).toContain('Ctrl-C');
    expect(text).toContain('TRUNCATED');
    expect(text).toContain('Load more records');

    const group = component.commandGroups.find((candidate) => candidate.id === 'cmd-1')!;
    group.outputExpanded = true;
    component.setOutputViewMode(group, 'raw');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(fixture.nativeElement.textContent).toContain('active (running)');

    component.timelineFilters.query = 'no match';
    component.applyTimelineFilters();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(fixture.nativeElement.textContent).toContain('No timeline entries match');
  });

  it('renders populated global SSH and Agentic AI audit tables with load-more controls', async () => {
    component.loadAuditRecords();
    component.onTabChange(1);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Agentic AI Log Query');
    expect(text).toContain('Exact plan approved');
    expect(text).toContain('High CPU');
    expect(text).toContain('AWAITING_APPROVAL');
    expect(text).toContain('Load more events');
    expect(text).toContain('Load more alerts');
    expect(text).toContain('Load more incidents');
  });

  it('renders loading, notice, empty and direct-session branches', async () => {
    component.activeTabIndex = 0;
    component.sessions = [{ ...session, crId: '', truncated: false }];
    component.selectedSession = null;
    component.sessionFilterNotice = 'Showing recent audited sessions';
    component.isLoadingSessions = true;
    component.nextSessionCursor = undefined;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(fixture.nativeElement.textContent).toContain('Showing recent audited sessions');
    expect(fixture.nativeElement.textContent).toContain('Direct');

    component.isLoadingSessions = false;
    component.sessions = [];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    expect(fixture.nativeElement.textContent).toContain('No audited sessions found');
    expect(fixture.nativeElement.textContent).toContain('Select a session');
  });
});
