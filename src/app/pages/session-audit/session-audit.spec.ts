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
  let message: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
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
    message = { error: vi.fn(), success: vi.fn() };
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
    expect(component.timelineEntries.map((entry) => entry.type)).toEqual(['command']);
    expect(sessionAuditService.listRecords).toHaveBeenCalledWith('sess-1', 100, undefined);
  });

  it('builds one ordered timeline with lifecycle events, commands, and controls', () => {
    const timelineRecords: SessionAuditRecord[] = [
      {
        ...records[0],
        recordType: 'session_event',
        sequence: 1,
        commandId: undefined,
        commandText: 'session started',
        createdAt: '2026-07-01T00:00:00Z',
      },
      {
        ...records[0],
        sequence: 2,
        commandId: 'cmd-1',
        commandText: 'pwd',
        createdAt: '2026-07-01T00:01:00Z',
      },
      {
        ...records[1],
        sequence: 3,
        commandId: 'cmd-1',
        createdAt: '2026-07-01T00:01:01Z',
      },
      {
        ...records[0],
        recordType: 'session_event',
        sequence: 4,
        commandId: undefined,
        commandText: 'owner detached',
        createdAt: '2026-07-01T00:02:00Z',
      },
      {
        ...records[0],
        recordType: 'session_event',
        sequence: 5,
        commandId: undefined,
        commandText: 'owner rejoined',
        createdAt: '2026-07-01T00:03:00Z',
      },
      {
        ...records[0],
        recordType: 'control',
        sequence: 6,
        commandId: 'cmd-1',
        commandText: 'Ctrl-C',
        createdAt: '2026-07-01T00:04:00Z',
      },
    ];
    sessionAuditService.listRecords.mockReturnValueOnce(of({ records: timelineRecords }));

    component.selectSession(session);

    expect(component.timelineEntries.map((entry) => component.timelineEventText(entry))).toEqual([
      'session started',
      'pwd',
      'owner detached',
      'owner rejoined',
      'Ctrl-C',
    ]);
    expect(component.timelineEntries.map((entry) => component.timelineEventTag(entry))).toEqual([
      'Session event',
      'Command',
      'Session event',
      'Session event',
      'Control',
    ]);
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

  it('formats compact IDs, CR labels, and operator-facing record type labels', () => {
    expect(component.compactId('sess-92542f171a442422a72c03e214245a36')).toBe('sess-92542f...');
    expect(component.compactId('short-id')).toBe('short-id');
    expect(component.crLabel('37650e46-5a59-4cb0-b46e-427716ab8544')).toBe('CR-16AB8544');
    expect(component.crLabel('')).toBe('Direct');
    expect(component.recordTypeLabel('output')).toBe('Terminal output');
    expect(component.recordTypeLabel('command')).toBe('Commands');
    expect(component.recordTypeLabel('session_event')).toBe('Session events');
    expect(component.recordTypeLabel('control')).toBe('Controls');
  });

  it('copies the full raw ID instead of the compact display value', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    component.copyValue('sess-92542f171a442422a72c03e214245a36');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('sess-92542f171a442422a72c03e214245a36');
    expect(message.success).toHaveBeenCalledWith('Copied to clipboard');
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

  it('groups adjacent orphan output characters into one search row', () => {
    const orphanRecords: SessionAuditRecord[] = [
      { ...records[1], sequence: 8, commandId: undefined, outputDataBase64: btoa('a'), byteCount: 1 },
      { ...records[1], sequence: 7, commandId: undefined, outputDataBase64: btoa('t'), byteCount: 1 },
      { ...records[1], sequence: 6, commandId: undefined, outputDataBase64: btoa('r'), byteCount: 1 },
      { ...records[1], sequence: 5, commandId: undefined, outputDataBase64: btoa('l'), byteCount: 1 },
    ];
    sessionAuditService.listAuditRecords.mockReturnValueOnce(of({ records: orphanRecords }));

    component.applyRecordFilters();

    expect(component.auditRecordRows.length).toBe(1);
    expect(component.auditRecordRows[0].body).toBe('lrta');
    expect(component.auditRecordRows[0].sequenceContext).toBe('seq 5-8');
  });

  it('groups nearby orphan output records in one search row', () => {
    const orphanRecords: SessionAuditRecord[] = [
      { ...records[1], sequence: 11, commandId: undefined, outputDataBase64: btoa('c'), byteCount: 1 },
      { ...records[1], sequence: 8, commandId: undefined, outputDataBase64: btoa('b'), byteCount: 1 },
      { ...records[1], sequence: 5, commandId: undefined, outputDataBase64: btoa('a'), byteCount: 1 },
    ];
    sessionAuditService.listAuditRecords.mockReturnValueOnce(of({ records: orphanRecords }));

    component.applyRecordFilters();

    expect(component.auditRecordRows.length).toBe(1);
    expect(component.auditRecordRows[0].body).toBe('abc');
    expect(component.auditRecordRows[0].sequenceContext).toBe('seq 5-11');
  });

  it('keeps command-id output and orphan output in separate grouped search rows', () => {
    const mixedRecords: SessionAuditRecord[] = [
      { ...records[1], sequence: 5, commandId: 'cmd-1', outputDataBase64: btoa('/home\n'), byteCount: 6 },
      { ...records[1], sequence: 4, commandId: undefined, outputDataBase64: btoa('d'), byteCount: 1 },
      { ...records[1], sequence: 3, commandId: undefined, outputDataBase64: btoa('p'), byteCount: 1 },
    ];
    sessionAuditService.listAuditRecords.mockReturnValueOnce(of({ records: mixedRecords }));

    component.applyRecordFilters();

    expect(component.auditRecordRows.length).toBe(2);
    expect(component.auditRecordRows[0].sequenceContext).toBe('seq 5 - cmd-1');
    expect(component.auditRecordRows[0].body).toContain('/home');
    expect(component.auditRecordRows[1].sequenceContext).toBe('seq 3-4');
    expect(component.auditRecordRows[1].body).toBe('pd');
  });

  it('does not show command echo as fake startup output when command records exist', () => {
    const timelineRecords: SessionAuditRecord[] = [
      {
        ...records[0],
        sequence: 1,
        commandId: 'cmd-1',
        commandText: 'ls -lrta',
      },
      {
        ...records[0],
        sequence: 2,
        commandId: 'cmd-2',
        commandText: 'echo "test"',
      },
      {
        ...records[1],
        sequence: 3,
        commandId: undefined,
        outputDataBase64: btoa('ls -lrtaecho "test"'),
        byteCount: 20,
      },
    ];
    sessionAuditService.listRecords.mockReturnValueOnce(of({ records: timelineRecords }));

    component.selectSession(session);

    expect(component.commandGroups.map((group) => group.command.commandText)).toEqual([
      'ls -lrta',
      'echo "test"',
    ]);
    expect(component.commandGroups.some((group) => group.id === 'startup-output')).toBe(false);
  });

  it('labels real orphan output as terminal output in the timeline', () => {
    const orphanOnlyRecords: SessionAuditRecord[] = [
      {
        ...records[1],
        sequence: 1,
        commandId: undefined,
        outputDataBase64: btoa('login banner\r\n'),
        byteCount: 14,
      },
    ];
    sessionAuditService.listRecords.mockReturnValueOnce(of({ records: orphanOnlyRecords }));

    component.selectSession(session);

    expect(component.commandGroups.length).toBe(1);
    expect(component.commandGroups[0].command.commandText).toBe('Terminal output');
    expect(component.commandGroups[0].outputText).toBe('login banner');
  });

  it('formats legacy orphan command echo as readable lines without changing raw output', () => {
    const orphanOnlyRecords: SessionAuditRecord[] = [
      {
        ...records[1],
        sequence: 1,
        commandId: undefined,
        outputDataBase64: btoa('ls -lrtaecho "test"'),
        byteCount: 20,
      },
    ];
    sessionAuditService.listRecords.mockReturnValueOnce(of({ records: orphanOnlyRecords }));

    component.selectSession(session);

    const group = component.commandGroups[0];
    expect(group.command.commandText).toBe('Terminal output');
    expect(group.outputText).toBe('ls -lrta\necho "test"');
    expect(group.rawOutputText).toBe('ls -lrtaecho "test"');
  });

  it('formats legacy orphan command echo across detach and rejoin boundaries', () => {
    const orphanOnlyRecords: SessionAuditRecord[] = [
      {
        ...records[1],
        sequence: 1,
        commandId: undefined,
        outputDataBase64: btoa('echo "hello1234"ls -lrt'),
        byteCount: 22,
      },
    ];
    sessionAuditService.listRecords.mockReturnValueOnce(of({ records: orphanOnlyRecords }));

    component.selectSession(session);

    const group = component.commandGroups[0];
    expect(group.outputText).toBe('echo "hello1234"\nls -lrt');
    expect(group.rawOutputText).toBe('echo "hello1234"ls -lrt');
  });

  it('renders collapsed orphan command echo as readable command lines in search rows', () => {
    const searchRecords: SessionAuditRecord[] = [
      {
        ...records[0],
        sequence: 1,
        commandId: 'cmd-1',
        commandText: 'ls -lrta',
      },
      {
        ...records[0],
        sequence: 2,
        commandId: 'cmd-2',
        commandText: 'echo "test"',
      },
      {
        ...records[1],
        sequence: 3,
        commandId: undefined,
        outputDataBase64: btoa('ls -lrtaecho "test"'),
        byteCount: 20,
      },
    ];
    sessionAuditService.listAuditRecords.mockReturnValueOnce(of({ records: searchRecords }));

    component.applyRecordFilters();

    const outputRow = component.auditRecordRows.find((row) => row.primary.recordType === 'output');
    expect(outputRow?.body).toBe('ls -lrta\necho "test"');
  });

  it('removes command echo from clean command output while preserving raw output', () => {
    const echoedOutput: SessionAuditRecord = {
      ...records[1],
      outputDataBase64: btoa('pwd\r\n/home/ubuntu\r\n'),
      byteCount: 18,
    };
    sessionAuditService.listRecords.mockReturnValueOnce(of({ records: [records[0], echoedOutput] }));

    component.selectSession(session);

    const group = component.commandGroups[0];
    expect(group.outputText).toBe('/home/ubuntu');
    expect(group.rawOutputText).toContain('pwd\r\n');
    expect(component.displayOutput(group)).toBe('/home/ubuntu');

    component.setOutputViewMode(group, 'raw');

    expect(component.displayOutput(group)).toContain('pwd\r\n');
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
