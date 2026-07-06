import { of, throwError } from 'rxjs';
import {
  AuditSessionSummary,
  SessionAuditRecord,
  SessionAuditService,
} from '../../services/session-audit.service';
import { IncidentAgentService } from '../../services/incident-agent.service';
import { SessionAudit } from './session-audit';

describe('SessionAudit', () => {
  let component: SessionAudit;
  let sessionAuditService: {
    listSessions: ReturnType<typeof vi.fn>;
    listAuditRecords: ReturnType<typeof vi.fn>;
    listRecords: ReturnType<typeof vi.fn>;
  };
  let incidentAgentService: {
    listEvents: ReturnType<typeof vi.fn>;
    listAlerts: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let message: { error: ReturnType<typeof vi.fn> };
  let route: { snapshot: { queryParamMap: { get: ReturnType<typeof vi.fn> } } };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const session: AuditSessionSummary = {
    sessionId: 'sess-1',
    userId: 'user-1',
    hostId: 'host-1',
    crId: 'cr-1',
    connectionType: 'ssh',
    status: 'CLOSED',
    createdAt: '2026-07-01T00:00:00Z',
    lastAuditAt: '2026-07-01T00:05:00Z',
    recordCount: 2,
    truncated: false,
  };

  const records: SessionAuditRecord[] = [
    {
      sessionId: 'sess-1',
      userId: 'user-1',
      hostId: 'host-1',
      crId: 'cr-1',
      recordType: 'command',
      sequence: 1,
      commandId: 'cmd-1',
      commandText: 'pwd',
      createdAt: '2026-07-01T00:01:00Z',
      truncated: false,
      byteCount: 3,
    },
    {
      sessionId: 'sess-1',
      userId: 'user-1',
      hostId: 'host-1',
      crId: 'cr-1',
      recordType: 'output',
      sequence: 2,
      commandId: 'cmd-1',
      outputDataBase64: btoa('/home/ubuntu\r\n'),
      createdAt: '2026-07-01T00:01:01Z',
      truncated: false,
      byteCount: 14,
    },
  ];

  beforeEach(() => {
    sessionAuditService = {
      listSessions: vi.fn(() => of({ sessions: [session] })),
      listAuditRecords: vi.fn(() => of({ records })),
      listRecords: vi.fn(() => of({ records })),
    };
    incidentAgentService = {
      listEvents: vi.fn(() => of({ events: [] })),
      listAlerts: vi.fn(() => of({ alerts: [] })),
      list: vi.fn(() => of({ incidents: [] })),
    };
    message = { error: vi.fn() };
    route = { snapshot: { queryParamMap: { get: vi.fn(() => null) } } };
    router = { navigate: vi.fn() };
    component = new SessionAudit(
      sessionAuditService as unknown as SessionAuditService,
      incidentAgentService as unknown as IncidentAgentService,
      message as any,
      route as any,
      router as any,
    );
  });

  it('loads sessions and selects the first session on init', () => {
    component.ngOnInit();

    expect(sessionAuditService.listSessions).toHaveBeenCalled();
    expect(component.sessions).toEqual([session]);
    expect(component.selectedSession?.sessionId).toBe('sess-1');
    expect(sessionAuditService.listRecords).toHaveBeenCalledWith('sess-1', 500, undefined);
    expect(sessionAuditService.listAuditRecords).toHaveBeenCalled();
    expect(incidentAgentService.listEvents).toHaveBeenCalled();
  });

  it('groups command output by command id', () => {
    component.records = records;

    const groups = component.commandGroups;
    expect(groups.length).toBe(1);
    expect(groups[0].command.commandText).toBe('pwd');
    expect(component.outputText(groups[0].outputs)).toContain('/home/ubuntu');
  });

  it('applies filters when searching', () => {
    component.filters.userId = 'user-2';
    component.applyFilters();

    expect(sessionAuditService.listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: 'user-2', limit: 50 }),
    );
  });

  it('shows an error when records fail to load', () => {
    sessionAuditService.listRecords.mockReturnValueOnce(throwError(() => new Error('boom')));

    component.selectSession(session);

    expect(message.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load audit records'));
  });

  it('loads global SSH records and Agentic AI metadata filters', () => {
    component.recordFilters.hostId = 'host-1';
    component.applyRecordFilters();
    expect(sessionAuditService.listAuditRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ hostId: 'host-1', limit: 100 }),
    );

    component.agentFilters.incidentId = 'inc-1';
    component.applyAgentFilters();
    expect(incidentAgentService.listEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ incidentId: 'inc-1', limit: 100 }),
    );
    expect(incidentAgentService.listAlerts).toHaveBeenLastCalledWith(
      expect.objectContaining({ incidentId: 'inc-1', limit: 50 }),
    );
    expect(incidentAgentService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ incidentId: 'inc-1', limit: 50 }),
    );
  });

  it('cross-links sessions to Agentic AI filters', () => {
    component.searchAgenticForSession(session);

    expect(component.activeTabIndex).toBe(1);
    expect(component.agentFilters.hostId).toBe('host-1');
    expect(router.navigate).toHaveBeenCalledWith(['/audit'], expect.objectContaining({
      queryParams: expect.objectContaining({ tab: 'agentic', hostId: 'host-1' }),
    }));
  });
});
