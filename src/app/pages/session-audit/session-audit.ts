import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AlertStatus,
  CloudWatchState,
  IncidentAgentService,
  IncidentEvent,
  IncidentEventType,
  IncidentState,
  IncidentSummary,
  ManagedAlert,
} from '../../services/incident-agent.service';
import { AuthService } from '../../services/auth.service';
import { IdentityService, ManagedUser } from '../../services/identity.service';
import {
  AuditSessionSummary,
  SessionAuditRecord,
  SessionAuditService,
} from '../../services/session-audit.service';
import { formatChangeRequestNumber } from '../../core/change-request.utils';

interface CommandGroup {
  id: string;
  command: SessionAuditRecord;
  outputs: SessionAuditRecord[];
  controls: SessionAuditRecord[];
  outputText: string;
  rawOutputText: string;
  outputBytes: number;
  hasTruncatedOutput: boolean;
}

type OutputViewMode = 'clean' | 'raw';

interface RecordFilters {
  sessionId: string;
  userId: string;
  hostId: string;
  crId: string;
  recordType: SessionAuditRecord['recordType'] | '';
  from: string;
  to: string;
}

interface AuditRecordSearchRow {
  key: string;
  primary: SessionAuditRecord;
  records: SessionAuditRecord[];
  body: string;
  sequenceContext: string;
  byteCount: number;
  truncated: boolean;
}

const SESSION_RECORD_LIMIT = 100;
const DEFAULT_RECORD_TYPE: SessionAuditRecord['recordType'] | '' = '';
const EMPTY_OUTPUT = 'No readable output retained for this record.';
const ORPHAN_OUTPUT_SEQUENCE_GAP = 4;

function defaultRecordFilters(): RecordFilters {
  return {
    sessionId: '',
    userId: '',
    hostId: '',
    crId: '',
    recordType: DEFAULT_RECORD_TYPE,
    from: '',
    to: '',
  };
}

@Component({
  selector: 'app-session-audit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './session-audit.html',
  styleUrl: './session-audit.css',
})
export class SessionAudit implements OnInit {
  readonly alertStatuses: AlertStatus[] = [
    'RECEIVED',
    'TRIAGING',
    'TRIAGED',
    'PENDING_APPROVAL',
    'EXECUTING',
    'RESOLVED',
    'REJECTED',
    'FAILED',
  ];
  readonly incidentStates: IncidentState[] = [
    'DIAGNOSING',
    'AWAITING_APPROVAL',
    'EXECUTING',
    'COMPLETED',
    'REJECTED',
    'RECOVERED',
    'FAILED',
  ];
  readonly eventTypes: IncidentEventType[] = [
    'AlertReceived',
    'AlertGrouped',
    'IncidentCreated',
    'AgentTriaged',
    'EvidenceCollected',
    'PlanProposed',
    'PlanExpired',
    'PlanApproved',
    'PlanRejected',
    'RemediationStarted',
    'AutomationTokenIssued',
    'OperationExecuted',
    'RemediationExecuted',
    'RemediationFailed',
    'VerificationOperationExecuted',
    'AutomationRunClosed',
    'VerificationPassed',
    'VerificationFailed',
    'IncidentRecovered',
  ];

  activeTabIndex = 0;
  filters = {
    sessionId: '',
    userId: '',
    hostId: '',
    crId: '',
    from: '',
    to: '',
  };
  recordFilters = defaultRecordFilters();
  agentFilters = {
    incidentId: '',
    alertId: '',
    hostId: '',
    alertStatus: '',
    cloudwatchState: '',
    incidentState: '',
    eventType: '',
    actor: '',
    from: '',
    to: '',
  };

  sessions: AuditSessionSummary[] = [];
  selectedSession: AuditSessionSummary | null = null;
  records: SessionAuditRecord[] = [];
  commandGroups: CommandGroup[] = [];
  sessionEventRecords: SessionAuditRecord[] = [];
  auditRecords: SessionAuditRecord[] = [];
  auditRecordRows: AuditRecordSearchRow[] = [];
  agentEvents: IncidentEvent[] = [];
  agentAlerts: ManagedAlert[] = [];
  agentIncidents: IncidentSummary[] = [];
  isLoadingSessions = false;
  isLoadingRecords = false;
  isLoadingAuditRecords = false;
  isLoadingAgentic = false;
  nextSessionCursor?: string;
  nextRecordCursor?: string;
  nextAuditRecordCursor?: string;
  nextAgentEventCursor?: string;
  nextAgentAlertCursor?: string;
  nextAgentIncidentCursor?: string;
  outputViewModes: Record<string, OutputViewMode> = {};
  private userDisplayBySub = new Map<string, string>();
  private hasLoadedSshSessions = false;
  private hasLoadedAgenticAudit = false;

  constructor(
    private sessionAudit: SessionAuditService,
    private incidentAgent: IncidentAgentService,
    private identityService: IdentityService,
    private auth: AuthService,
    private message: NzMessageService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.applyInitialQueryParams();
    this.loadIdentityUsers();
    if (this.activeTabIndex === 1) {
      this.loadAgenticAudit();
      return;
    }
    this.loadSessions();
    if (this.hasSshRecordFilters()) {
      this.loadAuditRecords();
    }
  }

  loadSessions(cursor?: string, keepSelected = false): void {
    this.isLoadingSessions = true;
    this.sessionAudit.listSessions({
      sessionId: this.filters.sessionId || undefined,
      userId: this.filters.userId || undefined,
      hostId: this.filters.hostId || undefined,
      crId: this.filters.crId || undefined,
      from: this.toIso(this.filters.from),
      to: this.toIso(this.filters.to),
      limit: 50,
      cursor,
    }).subscribe({
      next: (response) => {
        const sessions = response.sessions ?? [];
        this.sessions = cursor ? [...this.sessions, ...sessions] : sessions;
        this.nextSessionCursor = response.nextCursor;
        this.isLoadingSessions = false;
        this.hasLoadedSshSessions = true;
        if (!cursor && !keepSelected) {
          this.selectedSession = null;
          this.setRecords([]);
        }
        if (!cursor && keepSelected && this.selectedSession) {
          const refreshedSelection = sessions.find((session) => session.sessionId === this.selectedSession?.sessionId);
          if (refreshedSelection) {
            this.selectedSession = refreshedSelection;
          }
        }
      },
      error: (err) => {
        this.isLoadingSessions = false;
        this.message.error(`Failed to load session audit: ${err?.message ?? 'Unknown error'}`);
      },
    });
  }

  loadAuditRecords(cursor?: string): void {
    this.isLoadingAuditRecords = true;
    this.sessionAudit.listAuditRecords({
      sessionId: this.recordFilters.sessionId || undefined,
      userId: this.recordFilters.userId || undefined,
      hostId: this.recordFilters.hostId || undefined,
      crId: this.recordFilters.crId || undefined,
      recordType: (this.recordFilters.recordType as SessionAuditRecord['recordType']) || undefined,
      from: this.toIso(this.recordFilters.from),
      to: this.toIso(this.recordFilters.to),
      limit: 100,
      cursor,
    }).subscribe({
      next: (response) => {
        const records = response.records ?? [];
        this.auditRecords = cursor ? [...this.auditRecords, ...records] : records;
        this.auditRecordRows = this.buildAuditRecordRows(this.auditRecords);
        this.nextAuditRecordCursor = response.nextCursor;
        this.isLoadingAuditRecords = false;
      },
      error: (err) => {
        this.isLoadingAuditRecords = false;
        this.message.error(`Failed to load SSH audit records: ${err?.message ?? 'Unknown error'}`);
      },
    });
  }

  loadAgenticAudit(cursor?: string): void {
    this.isLoadingAgentic = true;
    this.incidentAgent.listEvents({
      incidentId: this.agentFilters.incidentId || undefined,
      alertId: this.agentFilters.alertId || undefined,
      eventType: (this.agentFilters.eventType as IncidentEventType) || undefined,
      actor: this.agentFilters.actor || undefined,
      from: this.toIso(this.agentFilters.from),
      to: this.toIso(this.agentFilters.to),
      limit: 100,
      cursor,
    }).subscribe({
      next: (response) => {
        const events = response.events ?? [];
        this.agentEvents = cursor ? [...this.agentEvents, ...events] : events;
        this.nextAgentEventCursor = response.nextCursor;
        this.isLoadingAgentic = false;
        this.hasLoadedAgenticAudit = true;
      },
      error: (err) => {
        this.isLoadingAgentic = false;
        this.message.error(`Failed to load Agentic AI events: ${err?.message ?? 'Unknown error'}`);
      },
    });
    if (!cursor) {
      this.loadAgenticAlerts();
      this.loadAgenticIncidents();
    }
  }

  loadAgenticAlerts(cursor?: string): void {
    this.incidentAgent.listAlerts({
      incidentId: this.agentFilters.incidentId || undefined,
      hostId: this.agentFilters.hostId || undefined,
      status: (this.agentFilters.alertStatus as AlertStatus) || undefined,
      cloudwatchState: (this.agentFilters.cloudwatchState as CloudWatchState) || undefined,
      from: this.toIso(this.agentFilters.from),
      to: this.toIso(this.agentFilters.to),
      limit: 50,
      cursor,
    }).subscribe({
      next: (response) => {
        const alerts = response.alerts ?? [];
        this.agentAlerts = cursor ? [...this.agentAlerts, ...alerts] : alerts;
        this.nextAgentAlertCursor = response.nextCursor;
      },
      error: (err) => this.message.error(`Failed to load Agentic AI alerts: ${err?.message ?? 'Unknown error'}`),
    });
  }

  loadAgenticIncidents(cursor?: string): void {
    this.incidentAgent.list({
      incidentId: this.agentFilters.incidentId || undefined,
      alertId: this.agentFilters.alertId || undefined,
      hostId: this.agentFilters.hostId || undefined,
      state: (this.agentFilters.incidentState as IncidentState) || undefined,
      from: this.toIso(this.agentFilters.from),
      to: this.toIso(this.agentFilters.to),
      limit: 50,
      cursor,
    }).subscribe({
      next: (response) => {
        const incidents = response.incidents ?? [];
        this.agentIncidents = cursor ? [...this.agentIncidents, ...incidents] : incidents;
        this.nextAgentIncidentCursor = response.nextCursor;
      },
      error: (err) => this.message.error(`Failed to load Agentic AI incidents: ${err?.message ?? 'Unknown error'}`),
    });
  }

  applyFilters(): void {
    this.loadSessions();
  }

  applyRecordFilters(): void {
    this.loadAuditRecords();
  }

  applyAgentFilters(): void {
    this.loadAgenticAudit();
  }

  resetFilters(): void {
    this.filters = { sessionId: '', userId: '', hostId: '', crId: '', from: '', to: '' };
    this.loadSessions();
  }

  resetRecordFilters(): void {
    this.recordFilters = defaultRecordFilters();
    this.loadAuditRecords();
  }

  resetAgentFilters(): void {
    this.agentFilters = {
      incidentId: '',
      alertId: '',
      hostId: '',
      alertStatus: '',
      cloudwatchState: '',
      incidentState: '',
      eventType: '',
      actor: '',
      from: '',
      to: '',
    };
    this.loadAgenticAudit();
  }

  selectSession(session: AuditSessionSummary): void {
    this.selectedSession = session;
    this.records = [];
    this.nextRecordCursor = undefined;
    this.loadRecords();
  }

  loadRecords(cursor?: string): void {
    if (!this.selectedSession) return;
    this.isLoadingRecords = true;
    this.sessionAudit.listRecords(this.selectedSession.sessionId, SESSION_RECORD_LIMIT, cursor).subscribe({
      next: (response) => {
        const records = response.records ?? [];
        this.setRecords(cursor ? [...this.records, ...records] : records);
        this.nextRecordCursor = response.nextCursor;
        this.isLoadingRecords = false;
      },
      error: (err) => {
        this.isLoadingRecords = false;
        this.message.error(`Failed to load audit records: ${err?.message ?? 'Unknown error'}`);
      },
    });
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
    if (index === 1 && !this.hasLoadedAgenticAudit) {
      this.loadAgenticAudit();
      return;
    }
    if (index === 0 && !this.hasLoadedSshSessions) {
      this.loadSessions();
    }
  }

  refreshActiveTab(): void {
    if (this.activeTabIndex === 1) {
      this.loadAgenticAudit();
      return;
    }
    this.loadSessions();
  }

  private setRecords(records: SessionAuditRecord[]): void {
    this.records = records;
    this.commandGroups = this.buildCommandGroups(records);
    this.sessionEventRecords = records.filter((record) => record.recordType === 'session_event');
  }

  private buildCommandGroups(records: SessionAuditRecord[]): CommandGroup[] {
    const groups = new Map<string, CommandGroup>();
    const orphanOutputs: SessionAuditRecord[] = [];
    const commandTexts: string[] = [];
    for (const record of records) {
      if (record.recordType === 'command') {
        if (record.commandText) {
          commandTexts.push(record.commandText);
        }
        const id = record.commandId || `seq-${record.sequence}`;
        groups.set(id, {
          id,
          command: record,
          outputs: [],
          controls: [],
          outputText: '',
          rawOutputText: '',
          outputBytes: 0,
          hasTruncatedOutput: false,
        });
        continue;
      }
      if (record.recordType === 'output') {
        const group = record.commandId ? groups.get(record.commandId) : undefined;
        if (group) {
          group.outputs.push(record);
        } else {
          orphanOutputs.push(record);
        }
        continue;
      }
      if (record.recordType === 'control' && record.commandId && groups.has(record.commandId)) {
        groups.get(record.commandId)!.controls.push(record);
      }
    }
    const result = [...groups.values()];
    const visibleOrphanOutputs = this.visibleOrphanOutputs(orphanOutputs, commandTexts);
    if (visibleOrphanOutputs.length > 0) {
      result.unshift({
        id: 'startup-output',
        command: {
          ...visibleOrphanOutputs[0],
          recordType: 'command',
          commandText: 'Terminal output',
          commandId: 'startup-output',
        },
        outputs: visibleOrphanOutputs,
        controls: [],
        outputText: '',
        rawOutputText: '',
        outputBytes: 0,
        hasTruncatedOutput: false,
      });
    }
    for (const group of result) {
      group.rawOutputText = this.rawOutputText(group.outputs);
      group.outputText = this.cleanCommandOutputText(group.outputs, group.command.commandText);
      group.outputBytes = this.outputBytes(group.outputs);
      group.hasTruncatedOutput = this.hasTruncated(group.outputs);
    }
    return result;
  }

  outputText(records: SessionAuditRecord[]): string {
    return this.cleanTerminalText(this.rawOutputText(records));
  }

  rawOutputText(records: SessionAuditRecord[]): string {
    return records.map((record) => this.decodeOutput(record.outputDataBase64 ?? '')).join('');
  }

  outputBytes(records: SessionAuditRecord[]): number {
    return records.reduce((total, record) => total + record.byteCount, 0);
  }

  hasTruncated(records: SessionAuditRecord[]): boolean {
    return records.some((record) => record.truncated);
  }

  outputViewMode(group: CommandGroup): OutputViewMode {
    return this.outputViewModes[group.id] ?? 'clean';
  }

  setOutputViewMode(group: CommandGroup, mode: OutputViewMode): void {
    this.outputViewModes[group.id] = mode;
  }

  displayOutput(group: CommandGroup): string {
    return this.outputViewMode(group) === 'raw' ? group.rawOutputText : group.outputText;
  }

  recordBodyPreview(record: SessionAuditRecord): string {
    if (record.recordType === 'command' || record.recordType === 'session_event') {
      return record.commandText || '-';
    }
    if (record.recordType === 'control') {
      return record.commandText || 'control event';
    }
    const preview = this.outputText([record]).trim();
    return preview ? this.truncate(preview, 240) : `${record.byteCount} bytes output (${EMPTY_OUTPUT})`;
  }

  recordSequenceContext(record: SessionAuditRecord): string {
    const parts = [`seq ${record.sequence}`];
    if (record.commandId) {
      parts.push(record.commandId);
    }
    return parts.join(' - ');
  }

  openRecordTimeline(record: SessionAuditRecord): void {
    this.activeTabIndex = 0;
    this.filters = {
      sessionId: record.sessionId,
      userId: '',
      hostId: '',
      crId: '',
      from: '',
      to: '',
    };
    this.selectedSession = this.sessions.find((session) => session.sessionId === record.sessionId) ?? {
      sessionId: record.sessionId,
      userId: record.userId,
      hostId: record.hostId,
      crId: record.crId,
      connectionType: 'ssh',
      status: 'UNKNOWN',
      createdAt: record.createdAt,
      lastAuditAt: record.createdAt,
      recordCount: 0,
      truncated: record.truncated,
    };
    this.records = [];
    this.nextRecordCursor = undefined;
    this.loadSessions(undefined, true);
    this.loadRecords();
  }

  searchAgenticForSession(session: AuditSessionSummary): void {
    this.activeTabIndex = 1;
    this.agentFilters.hostId = session.hostId;
    this.agentFilters.from = this.toLocalInput(this.windowStart(session.createdAt));
    this.agentFilters.to = this.toLocalInput(this.windowEnd(session.lastAuditAt));
    this.loadAgenticAudit();
    this.router.navigate(['/audit'], { queryParams: this.agenticQueryParams() });
  }

  searchSshForAlert(alert: ManagedAlert): void {
    this.activeTabIndex = 0;
    this.recordFilters.recordType = DEFAULT_RECORD_TYPE;
    this.recordFilters.hostId = alert.hostId;
    this.recordFilters.from = this.toLocalInput(this.windowStart(alert.occurredAt));
    this.recordFilters.to = this.toLocalInput(this.windowEnd(alert.occurredAt));
    this.loadAuditRecords();
    this.router.navigate(['/audit'], { queryParams: this.sshQueryParams() });
  }

  searchSshForIncident(incident: IncidentSummary): void {
    this.activeTabIndex = 0;
    this.recordFilters.recordType = DEFAULT_RECORD_TYPE;
    this.recordFilters.hostId = incident.hostId;
    this.recordFilters.from = this.toLocalInput(this.windowStart(incident.createdAt));
    this.recordFilters.to = this.toLocalInput(this.windowEnd(incident.updatedAt));
    this.loadAuditRecords();
    this.router.navigate(['/audit'], { queryParams: this.sshQueryParams() });
  }

  metadata(value: unknown): string {
    if (!value || typeof value !== 'object') {
      return '';
    }
    return JSON.stringify(value);
  }

  cleanTerminalText(value: string): string {
    const withoutEscapes = value
      .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
      .replace(/\x1b[P^_][\s\S]*?\x1b\\/g, '')
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/\x1b[()][A-Za-z0-9]/g, '')
      .replace(/\x1b[=>]/g, '')
      .replace(/\r\n/g, '\n');
    const lines = [''];
    let column = 0;

    for (const char of withoutEscapes) {
      const code = char.charCodeAt(0);
      if (char === '\r') {
        column = 0;
        continue;
      }
      if (char === '\n') {
        lines.push('');
        column = 0;
        continue;
      }
      if (char === '\b' || char === '\x7f') {
        if (column > 0) {
          const line = lines[lines.length - 1];
          lines[lines.length - 1] = line.slice(0, column - 1) + line.slice(column);
          column -= 1;
        }
        continue;
      }
      if (char === '\t') {
        const spaces = 4 - (column % 4);
        for (let i = 0; i < spaces; i += 1) {
          this.writeTerminalChar(lines, column, ' ');
          column += 1;
        }
        continue;
      }
      if (code < 32 || code === 127 || (code >= 128 && code <= 159)) {
        continue;
      }
      this.writeTerminalChar(lines, column, char);
      column += 1;
    }

    return lines.join('\n').replace(/[ \t]+\n/g, '\n').replace(/[ \t]+$/g, '');
  }

  displayUser(userId: string): string {
    return this.userDisplayBySub.get(userId) ?? userId;
  }

  compactId(value: string, visibleChars = 11): string {
    if (!value || value.length <= visibleChars + 3) {
      return value;
    }
    return `${value.slice(0, visibleChars)}...`;
  }

  copyValue(value: string, event?: Event): void {
    event?.stopPropagation();
    if (!value) {
      return;
    }
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) {
      this.message.error('Clipboard is not available');
      return;
    }
    void clipboard.writeText(value).then(
      () => this.message.success('Copied to clipboard'),
      () => this.message.error('Failed to copy value'),
    );
  }

  sessionStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'CLOSED':
        return 'default';
      default:
        return 'blue';
    }
  }

  recordTypeLabel(recordType: SessionAuditRecord['recordType']): string {
    switch (recordType) {
      case 'command':
        return 'Commands';
      case 'output':
        return 'Terminal output';
      case 'control':
        return 'Controls';
      case 'session_event':
        return 'Session events';
    }
  }

  crLabel(crId: string): string {
    return crId ? formatChangeRequestNumber(crId) : 'Direct';
  }

  rowBodyPreview(row: AuditRecordSearchRow): string {
    return row.body;
  }

  rowSequenceContext(row: AuditRecordSearchRow): string {
    return row.sequenceContext;
  }

  private loadIdentityUsers(): void {
    if (!this.auth.hasPermission('identity.users.view')) {
      return;
    }
    this.identityService.listUsers().subscribe({
      next: (users) => {
        this.userDisplayBySub = this.buildUserDisplayMap(users ?? []);
      },
      error: () => {
        this.userDisplayBySub = new Map<string, string>();
      },
    });
  }

  private buildUserDisplayMap(users: ManagedUser[]): Map<string, string> {
    const display = new Map<string, string>();
    for (const user of users) {
      if (!user.sub) {
        continue;
      }
      display.set(user.sub, user.name || user.username || user.sub);
    }
    return display;
  }

  private buildAuditRecordRows(records: SessionAuditRecord[]): AuditRecordSearchRow[] {
    const rows: AuditRecordSearchRow[] = [];
    const outputGroups = new Map<string, AuditRecordSearchRow>();
    const commandTextByID = this.commandTextByID(records);
    const commandTextsBySession = this.commandTextsBySession(records);
    let activeOrphanOutputRow: AuditRecordSearchRow | undefined;
    for (const record of records) {
      if (record.recordType !== 'output' || record.commandId) {
        activeOrphanOutputRow = undefined;
      }
      if (record.recordType === 'output' && record.commandId) {
        const key = `output:${record.sessionId}:${record.commandId}`;
        let row = outputGroups.get(key);
        if (!row) {
          row = {
            key,
            primary: record,
            records: [],
            body: '',
            sequenceContext: '',
            byteCount: 0,
            truncated: false,
          };
          outputGroups.set(key, row);
          rows.push(row);
        }
        row.records.push(record);
        continue;
      }
      if (record.recordType === 'output') {
        if (
          activeOrphanOutputRow &&
          activeOrphanOutputRow.primary.sessionId === record.sessionId &&
          this.isNearOutputSequence(activeOrphanOutputRow.records[activeOrphanOutputRow.records.length - 1], record)
        ) {
          activeOrphanOutputRow.records.push(record);
          continue;
        }
        activeOrphanOutputRow = {
          key: `output-orphan:${record.sessionId}:${record.sequence}`,
          primary: record,
          records: [record],
          body: '',
          sequenceContext: '',
          byteCount: 0,
          truncated: false,
        };
        rows.push(activeOrphanOutputRow);
        continue;
      }
      rows.push(this.buildSingleAuditRecordRow(record));
    }

    for (const row of rows.filter((candidate) => candidate.primary.recordType === 'output')) {
      const ordered = [...row.records].sort((a, b) => a.sequence - b.sequence);
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const commandText = first.commandId ? commandTextByID.get(first.commandId) : undefined;
      const preview = first.commandId
        ? this.cleanCommandOutputText(ordered, commandText).trim()
        : this.cleanOrphanOutputText(ordered, commandTextsBySession.get(first.sessionId) ?? []).trim();
      row.body = preview ? this.truncate(preview, 500) : `${this.outputBytes(ordered)} bytes output (${EMPTY_OUTPUT})`;
      row.sequenceContext = first.sequence === last.sequence
        ? this.recordSequenceContext(first)
        : first.commandId
          ? `seq ${first.sequence}-${last.sequence} - ${first.commandId}`
          : `seq ${first.sequence}-${last.sequence}`;
      row.byteCount = this.outputBytes(ordered);
      row.truncated = this.hasTruncated(ordered);
    }
    return rows;
  }

  private buildSingleAuditRecordRow(record: SessionAuditRecord): AuditRecordSearchRow {
    return {
      key: `${record.recordType}:${record.sessionId}:${record.sequence}`,
      primary: record,
      records: [record],
      body: this.recordBodyPreview(record),
      sequenceContext: this.recordSequenceContext(record),
      byteCount: record.byteCount,
      truncated: record.truncated,
    };
  }

  private cleanCommandOutputText(records: SessionAuditRecord[], commandText?: string): string {
    const clean = this.outputText(records).trim();
    if (!commandText) {
      return clean;
    }
    return this.stripLeadingCommandEcho(clean, commandText);
  }

  private cleanOrphanOutputText(records: SessionAuditRecord[], commandTexts: string[]): string {
    const clean = this.outputText(records).trim();
    if (!clean || commandTexts.length === 0) {
      return clean;
    }
    if (this.isCommandEchoOnly(clean, commandTexts)) {
      return commandTexts.join('\n');
    }
    return clean;
  }

  private visibleOrphanOutputs(records: SessionAuditRecord[], commandTexts: string[]): SessionAuditRecord[] {
    if (records.length === 0 || commandTexts.length === 0) {
      return records;
    }
    const clean = this.outputText(records).trim();
    return this.isCommandEchoOnly(clean, commandTexts) ? [] : records;
  }

  private stripLeadingCommandEcho(value: string, commandText: string): string {
    const trimmed = value.trimStart();
    if (trimmed === commandText) {
      return '';
    }
    if (trimmed.startsWith(`${commandText}\n`)) {
      return trimmed.slice(commandText.length).trimStart();
    }
    if (trimmed.startsWith(commandText)) {
      return trimmed.slice(commandText.length).trimStart();
    }
    return value;
  }

  private isCommandEchoOnly(value: string, commandTexts: string[]): boolean {
    const normalizedValue = this.normalizeEchoText(value);
    if (!normalizedValue) {
      return false;
    }
    const normalizedCommands = this.normalizeEchoText(commandTexts.join(''));
    return normalizedValue === normalizedCommands ||
      normalizedCommands.includes(normalizedValue) ||
      normalizedValue.includes(normalizedCommands);
  }

  private normalizeEchoText(value: string): string {
    return value.replace(/\s+/g, '');
  }

  private commandTextByID(records: SessionAuditRecord[]): Map<string, string> {
    const commands = new Map<string, string>();
    for (const record of records) {
      if (record.recordType === 'command' && record.commandId && record.commandText) {
        commands.set(record.commandId, record.commandText);
      }
    }
    return commands;
  }

  private commandTextsBySession(records: SessionAuditRecord[]): Map<string, string[]> {
    const commands = new Map<string, SessionAuditRecord[]>();
    for (const record of records) {
      if (record.recordType !== 'command' || !record.commandText) {
        continue;
      }
      const sessionCommands = commands.get(record.sessionId) ?? [];
      sessionCommands.push(record);
      commands.set(record.sessionId, sessionCommands);
    }
    const result = new Map<string, string[]>();
    for (const [sessionID, sessionCommands] of commands.entries()) {
      result.set(
        sessionID,
        sessionCommands.sort((a, b) => a.sequence - b.sequence).map((record) => record.commandText ?? ''),
      );
    }
    return result;
  }

  private isNearOutputSequence(previous: SessionAuditRecord, current: SessionAuditRecord): boolean {
    return Math.abs(previous.sequence - current.sequence) <= ORPHAN_OUTPUT_SEQUENCE_GAP;
  }

  private decodeOutput(value: string): string {
    try {
      const binary = atob(value);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return '';
    }
  }

  private toIso(value: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private toLocalInput(value: Date): string {
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  private windowStart(value: string): Date {
    const date = new Date(value);
    return new Date((Number.isNaN(date.getTime()) ? Date.now() : date.getTime()) - 30 * 60 * 1000);
  }

  private windowEnd(value: string): Date {
    const date = new Date(value);
    return new Date((Number.isNaN(date.getTime()) ? Date.now() : date.getTime()) + 30 * 60 * 1000);
  }

  private applyInitialQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    this.activeTabIndex = params.get('tab') === 'agentic' ? 1 : 0;
    this.recordFilters.hostId = params.get('hostId') ?? '';
    this.recordFilters.from = this.fromIsoParam(params.get('from'));
    this.recordFilters.to = this.fromIsoParam(params.get('to'));
    this.recordFilters.recordType = this.fromRecordTypeParam(params.get('recordType'));
    this.agentFilters.hostId = params.get('hostId') ?? '';
    this.agentFilters.incidentId = params.get('incidentId') ?? '';
    this.agentFilters.alertId = params.get('alertId') ?? '';
    this.agentFilters.from = this.fromIsoParam(params.get('from'));
    this.agentFilters.to = this.fromIsoParam(params.get('to'));
  }

  private fromIsoParam(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : this.toLocalInput(date);
  }

  private fromRecordTypeParam(value: string | null): SessionAuditRecord['recordType'] | '' {
    if (
      value === 'command' ||
      value === 'output' ||
      value === 'control' ||
      value === 'session_event'
    ) {
      return value;
    }
    return '';
  }

  private hasSshRecordFilters(): boolean {
    return Boolean(
      this.recordFilters.sessionId ||
      this.recordFilters.userId ||
      this.recordFilters.hostId ||
      this.recordFilters.crId ||
      this.recordFilters.from ||
      this.recordFilters.to ||
      this.recordFilters.recordType !== DEFAULT_RECORD_TYPE,
    );
  }

  private sshQueryParams(): Record<string, string> {
    const params: Record<string, string> = { tab: 'ssh' };
    if (this.recordFilters.hostId) params['hostId'] = this.recordFilters.hostId;
    if (this.recordFilters.recordType && this.recordFilters.recordType !== DEFAULT_RECORD_TYPE) {
      params['recordType'] = this.recordFilters.recordType;
    }
    const from = this.toIso(this.recordFilters.from);
    const to = this.toIso(this.recordFilters.to);
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return params;
  }

  private truncate(value: string, maxLength: number): string {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
  }

  private writeTerminalChar(lines: string[], column: number, char: string): void {
    const line = lines[lines.length - 1];
    if (column >= line.length) {
      lines[lines.length - 1] = line.padEnd(column, ' ') + char;
      return;
    }
    lines[lines.length - 1] = line.slice(0, column) + char + line.slice(column + 1);
  }

  private agenticQueryParams(): Record<string, string> {
    const params: Record<string, string> = { tab: 'agentic' };
    if (this.agentFilters.hostId) params['hostId'] = this.agentFilters.hostId;
    const from = this.toIso(this.agentFilters.from);
    const to = this.toIso(this.agentFilters.to);
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return params;
  }
}
