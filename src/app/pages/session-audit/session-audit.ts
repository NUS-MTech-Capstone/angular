import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuditSessionSummary,
  SessionAuditRecord,
  SessionAuditService,
} from '../../services/session-audit.service';

interface CommandGroup {
  command: SessionAuditRecord;
  outputs: SessionAuditRecord[];
  controls: SessionAuditRecord[];
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
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './session-audit.html',
  styleUrl: './session-audit.css',
})
export class SessionAudit implements OnInit {
  filters = {
    sessionId: '',
    userId: '',
    hostId: '',
    crId: '',
    from: '',
    to: '',
  };

  sessions: AuditSessionSummary[] = [];
  selectedSession: AuditSessionSummary | null = null;
  records: SessionAuditRecord[] = [];
  isLoadingSessions = false;
  isLoadingRecords = false;
  nextSessionCursor?: string;
  nextRecordCursor?: string;

  constructor(
    private sessionAudit: SessionAuditService,
    private message: NzMessageService,
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(cursor?: string): void {
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
        this.sessions = cursor ? [...this.sessions, ...response.sessions] : response.sessions;
        this.nextSessionCursor = response.nextCursor;
        this.isLoadingSessions = false;
        if (!cursor && this.sessions.length > 0) {
          this.selectSession(this.sessions[0]);
        } else if (!cursor) {
          this.selectedSession = null;
          this.records = [];
        }
      },
      error: (err) => {
        this.isLoadingSessions = false;
        this.message.error(`Failed to load session audit: ${err?.message ?? 'Unknown error'}`);
      },
    });
  }

  applyFilters(): void {
    this.loadSessions();
  }

  resetFilters(): void {
    this.filters = { sessionId: '', userId: '', hostId: '', crId: '', from: '', to: '' };
    this.loadSessions();
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
    this.sessionAudit.listRecords(this.selectedSession.sessionId, 500, cursor).subscribe({
      next: (response) => {
        this.records = cursor ? [...this.records, ...response.records] : response.records;
        this.nextRecordCursor = response.nextCursor;
        this.isLoadingRecords = false;
      },
      error: (err) => {
        this.isLoadingRecords = false;
        this.message.error(`Failed to load audit records: ${err?.message ?? 'Unknown error'}`);
      },
    });
  }

  get commandGroups(): CommandGroup[] {
    const groups = new Map<string, CommandGroup>();
    const orphanOutputs: SessionAuditRecord[] = [];
    for (const record of this.records) {
      if (record.recordType === 'command') {
        const id = record.commandId || `seq-${record.sequence}`;
        groups.set(id, { command: record, outputs: [], controls: [] });
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
    if (orphanOutputs.length > 0) {
      result.unshift({
        command: {
          ...orphanOutputs[0],
          recordType: 'command',
          commandText: 'Session output before first command',
          commandId: 'startup-output',
        },
        outputs: orphanOutputs,
        controls: [],
      });
    }
    return result;
  }

  sessionEvents(): SessionAuditRecord[] {
    return this.records.filter((record) => record.recordType === 'session_event');
  }

  outputText(records: SessionAuditRecord[]): string {
    return records.map((record) => this.decodeOutput(record.outputDataBase64 ?? '')).join('');
  }

  outputBytes(records: SessionAuditRecord[]): number {
    return records.reduce((total, record) => total + record.byteCount, 0);
  }

  hasTruncated(records: SessionAuditRecord[]): boolean {
    return records.some((record) => record.truncated);
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
}
