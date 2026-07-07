import { of, throwError } from 'rxjs';
import {
  AuditSessionSummary,
  SessionAuditRecord,
  SessionAuditService,
} from '../../services/session-audit.service';
import { IncidentAgentService } from '../../services/incident-agent.service';
import { AuthService } from '../../services/auth.service';
import { IdentityService } from '../../services/identity.service';
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
  let identityService: { listUsers: ReturnType<typeof vi.fn> };
  let authService: { hasPermission: ReturnType<typeof vi.fn> };
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
    identityService = {
      listUsers: vi.fn(() => of([
        {
          sub: 'user-1',
          username: 'alice',
          name: 'Alice Admin',
          enabled: true,
          status: 'CONFIRMED',
          roles: [],
        },
      ])),
    };
    authService = {
      hasPermission: vi.fn(() => true),
    };
    message = { error: vi.fn() };
    route = { snapshot: { queryParamMap: { get: vi.fn(() => null) } } };
    router = { navigate: vi.fn() };
    component = new SessionAudit(
      sessionAuditService as unknown as SessionAuditService,
      incidentAgentService as unknown as IncidentAgentService,
      identityService as unknown as IdentityService,
      authService as unknown as AuthService,
      message as any,
      route as any,
      router as any,
    );
  });

  it('loads sessions without fetching heavyweight detail views on init', () => {
    component.ngOnInit();

    expect(sessionAuditService.listSessions).toHaveBeenCalled();
    expect(identityService.listUsers).toHaveBeenCalled();
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
    expect(component.auditRecordRows).toEqual([]);
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
      expect.objectContaining({ hostId: 'host-1', limit: 100 }),
    );
    expect(sessionAuditService.listAuditRecords).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ recordType: 'command' }),
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

  it('uses all records as the default SSH record search and reset state', () => {
    expect(component.recordFilters.recordType).toBe('');

    component.applyRecordFilters();

    expect(sessionAuditService.listAuditRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
    expect(sessionAuditService.listAuditRecords).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ recordType: 'command' }),
    );

    component.recordFilters.recordType = 'output';
    component.recordFilters.hostId = 'host-1';
    component.resetRecordFilters();

    expect(component.recordFilters).toEqual({
      sessionId: '',
      userId: '',
      hostId: '',
      crId: '',
      recordType: '',
      from: '',
      to: '',
    });
    expect(sessionAuditService.listAuditRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
    expect(sessionAuditService.listAuditRecords).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ recordType: 'command' }),
    );
  });

  it('shows readable previews for output records', () => {
    const preview = component.recordBodyPreview(noisyOutputRecord);

    expect(preview).toContain('red');
    expect(preview).toContain('progress 100%');
    expect(preview).not.toContain('\x1b');
  });

  it('maps Cognito subjects to display names with raw id fallback', () => {
    component.ngOnInit();

    expect(component.displayUser('user-1')).toBe('Alice Admin');
    expect(component.displayUser('unknown-user')).toBe('unknown-user');
  });

  it('groups global terminal output chunks into one multiline row', () => {
    const outputA: SessionAuditRecord = {
      ...records[1],
      sequence: 2,
      outputDataBase64: btoa('ls -lrta\r\n'),
      byteCount: 10,
    };
    const outputB: SessionAuditRecord = {
      ...records[1],
      sequence: 3,
      createdAt: '2026-07-01T00:01:02Z',
      outputDataBase64: btoa('echo "test"\r\n'),
      byteCount: 13,
    };
    sessionAuditService.listAuditRecords.mockReturnValueOnce(of({ records: [outputB, outputA] }));

    component.applyRecordFilters();

    expect(component.auditRecordRows.length).toBe(1);
    expect(component.auditRecordRows[0].body).toContain('ls -lrta');
    expect(component.auditRecordRows[0].body).toContain('echo "test"');
    expect(component.auditRecordRows[0].body).toContain('\n');
    expect(component.auditRecordRows[0].sequenceContext).toBe('seq 2-3 - cmd-1');
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
