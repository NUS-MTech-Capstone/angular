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

  const noisyOutputRecord: SessionAuditRecord = {
    sessionId: 'sess-1',
    userId: 'user-1',
    hostId: 'host-1',
    crId: 'cr-1',
    recordType: 'output',
    sequence: 3,
    commandId: 'cmd-1',
    outputDataBase64: btoa('\x1b[31mred\x1b[0m\r\nold\b \bnew\nprogress 10%\rprogress 100%\n'),
    createdAt: '2026-07-01T00:01:02Z',
    truncated: false,
    byteCount: 52,
  };

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

  it('loads sessions without fetching heavyweight detail views on init', () => {
    component.ngOnInit();

    expect(sessionAuditService.listSessions).toHaveBeenCalled();
    expect(component.sessions).toEqual([session]);
    expect(component.selectedSession).toBeNull();
    expect(sessionAuditService.listRecords).not.toHaveBeenCalled();
    expect(sessionAuditService.listAuditRecords).not.toHaveBeenCalled();
    expect(incidentAgentService.listEvents).not.toHaveBeenCalled();
  });

  it('treats null audit and agentic lists as empty', () => {
    sessionAuditService.listSessions.mockReturnValueOnce(of({ sessions: null } as any));
    sessionAuditService.listAuditRecords.mockReturnValueOnce(of({ records: null } as any));
    incidentAgentService.listEvents.mockReturnValueOnce(of({ events: null } as any));
    incidentAgentService.listAlerts.mockReturnValueOnce(of({ alerts: null } as any));
    incidentAgentService.list.mockReturnValueOnce(of({ incidents: null } as any));

    component.ngOnInit();
    component.applyRecordFilters();
    component.onTabChange(1);

    expect(component.sessions).toEqual([]);
    expect(component.auditRecords).toEqual([]);
    expect(component.agentEvents).toEqual([]);
    expect(component.agentAlerts).toEqual([]);
    expect(component.agentIncidents).toEqual([]);
  });

  it('groups command output by command id', () => {
    component.selectSession(session);

    const groups = component.commandGroups;
    expect(groups.length).toBe(1);
    expect(groups[0].command.commandText).toBe('pwd');
    expect(groups[0].outputText).toContain('/home/ubuntu');
    expect(sessionAuditService.listRecords).toHaveBeenCalledWith('sess-1', 100, undefined);
  });

  it('cleans terminal escape sequences and keeps raw output available', () => {
    sessionAuditService.listRecords.mockReturnValueOnce(of({ records: [records[0], noisyOutputRecord] }));

    component.selectSession(session);

    const group = component.commandGroups[0];
    expect(group.rawOutputText).toContain('\x1b[31m');
    expect(group.outputText).toContain('red');
    expect(group.outputText).toContain('new');
    expect(group.outputText).toContain('progress 100%');
    expect(group.outputText).not.toContain('\x1b');
    expect(component.displayOutput(group)).toBe(group.outputText);

    component.setOutputViewMode(group, 'raw');

    expect(component.displayOutput(group)).toBe(group.rawOutputText);
  });

  it('strips OSC title controls from cleaned terminal text', () => {
    const cleaned = component.cleanTerminalText('\x1b]0;secret title\x07ready\r\ndone');

    expect(cleaned).toContain('ready');
    expect(cleaned).toContain('done');
    expect(cleaned).not.toContain('secret title');
    expect(cleaned).not.toContain('\x1b');
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
      expect.objectContaining({ hostId: 'host-1', recordType: 'command', limit: 100 }),
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

  it('uses command records as the default SSH record search and reset state', () => {
    expect(component.recordFilters.recordType).toBe('command');

    component.applyRecordFilters();

    expect(sessionAuditService.listAuditRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ recordType: 'command', limit: 100 }),
    );

    component.recordFilters.recordType = 'output';
    component.recordFilters.hostId = 'host-1';
    component.resetRecordFilters();

    expect(component.recordFilters).toEqual({
      sessionId: '',
      userId: '',
      hostId: '',
      crId: '',
      recordType: 'command',
      from: '',
      to: '',
    });
    expect(sessionAuditService.listAuditRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ recordType: 'command', limit: 100 }),
    );
  });

  it('shows readable previews for output records', () => {
    const preview = component.recordBodyPreview(noisyOutputRecord);

    expect(preview).toContain('red');
    expect(preview).toContain('progress 100%');
    expect(preview).not.toContain('\x1b');
  });

  it('opens a global record in the session timeline', () => {
    component.sessions = [session];

    component.openRecordTimeline(records[0]);

    expect(component.activeTabIndex).toBe(0);
    expect(component.filters.sessionId).toBe('sess-1');
    expect(component.selectedSession?.sessionId).toBe('sess-1');
    expect(sessionAuditService.listSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', limit: 50 }),
    );
    expect(sessionAuditService.listRecords).toHaveBeenLastCalledWith('sess-1', 100, undefined);
  });

  it('cross-links sessions to Agentic AI filters', () => {
    component.searchAgenticForSession(session);

    expect(component.activeTabIndex).toBe(1);
    expect(component.agentFilters.hostId).toBe('host-1');
    expect(router.navigate).toHaveBeenCalledWith(['/audit'], expect.objectContaining({
      queryParams: expect.objectContaining({ tab: 'agentic', hostId: 'host-1' }),
    }));
  });

  it('loads the Agentic AI tab lazily', () => {
    component.ngOnInit();
    expect(incidentAgentService.listEvents).not.toHaveBeenCalled();

    component.onTabChange(1);

    expect(incidentAgentService.listEvents).toHaveBeenCalled();
    expect(incidentAgentService.listAlerts).toHaveBeenCalled();
    expect(incidentAgentService.list).toHaveBeenCalled();
  });
});
