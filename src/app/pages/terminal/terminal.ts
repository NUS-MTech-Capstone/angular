import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { ITheme, Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { apiPath } from '../../core/api.constants';

/** Binary terminal protocol — must match proxy-dataplane/internal/protocol/packet.go */
const enum PktType {
  Input = 0x00,
  Output = 0x01,
  Error = 0x02,
  SessionEvent = 0x07,
  Resize = 0x10,
}

interface TerminalSettings {
  theme: string;
  fontFamily: string;
  fontSize: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  visualBell: boolean;
  copyOnSelect: boolean;
  rightClickPaste: boolean;
}

interface EventLogEntry {
  when: string;
  message: string;
}

const SETTINGS_STORAGE_KEY = 'ddm-terminal-settings';

const DEFAULT_SETTINGS: TerminalSettings = {
  theme: 'Dark Slate',
  fontFamily: 'Consolas, "Courier New", monospace',
  fontSize: 14,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 2000,
  visualBell: true,
  copyOnSelect: true,
  rightClickPaste: true,
};

const PUTTY_SELECTION = {
  selectionBackground: '#316ac5',
  selectionForeground: '#ffffff',
  selectionInactiveBackground: 'rgba(49, 106, 197, 0.45)',
} as const;

const THEMES: Record<string, ITheme> = {
  'Dark Slate': {
    background: '#373e4d',
    foreground: '#e8eaf0',
    cursor: '#ffffff',
    ...PUTTY_SELECTION,
  },
  'PuTTY Classic': {
    background: '#000000',
    foreground: '#bbbbbb',
    cursor: '#00ff00',
    ...PUTTY_SELECTION,
  },
  'Light': {
    background: '#ffffff',
    foreground: '#1f1f1f',
    cursor: '#1f1f1f',
    selectionBackground: '#0078d7',
    selectionForeground: '#ffffff',
    selectionInactiveBackground: 'rgba(0, 120, 215, 0.35)',
  },
  'Green Phosphor': {
    background: '#001100',
    foreground: '#00cc66',
    cursor: '#00ff88',
    selectionBackground: '#006622',
    selectionForeground: '#ccffcc',
    selectionInactiveBackground: 'rgba(0, 102, 34, 0.45)',
  },
  'Solarized Dark': {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#93a1a1',
    selectionBackground: '#094959',
    selectionForeground: '#fdf6e3',
    selectionInactiveBackground: 'rgba(9, 73, 89, 0.55)',
  },
};

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzDrawerModule,
    NzIconModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    NzTooltipModule,
  ],
  templateUrl: './terminal.html',
  styleUrls: ['./terminal.css'],
})
export class TerminalPage implements AfterViewInit, OnDestroy {
  @ViewChild('terminalHost') terminalHost!: ElementRef<HTMLDivElement>;

  osUser = 'kei';
  hostname = 'rhel_app2';
  ip = '10.12.12.12';
  crNumber = 'CR2025012412';
  hostId = '';
  crId = '';
  /** When set, skip sessions/start and reconnect to this existing session. */
  reconnectSessionId = '';

  connected = false;
  connecting = false;
  connectionError = '';
  bellFlash = false;
  isSettingsOpen = false;
  isEventLogOpen = false;

  settings: TerminalSettings = { ...DEFAULT_SETTINGS };
  themeOptions = Object.keys(THEMES);
  fontOptions = [
    'Consolas, "Courier New", monospace',
    '"Courier New", monospace',
    '"Cascadia Mono", Consolas, monospace',
    '"Lucida Console", monospace',
    'monospace',
  ];
  eventLog: EventLogEntry[] = [];

  private term!: Terminal;
  private fitAddon = new FitAddon();
  private ws: WebSocket | null = null;
  private encoder = new TextEncoder();
  private sessionLog: string[] = [];
  private terminalMouseUpHandler = (event: MouseEvent) => this.onTerminalMouseUp(event);
  private terminalAuxClickHandler = (event: MouseEvent) => this.onTerminalAuxClick(event);
  private resizeHandler = () => {
    this.fitAddon.fit();
    this.sendResize();
  };

  constructor(
    private route: ActivatedRoute,
    private titleService: Title,
    private cd: ChangeDetectorRef,
    private http: HttpClient,
  ) {}

  ngAfterViewInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.osUser = params.get('user') || this.osUser;
    this.hostname = params.get('host') || this.hostname;
    this.ip = params.get('ip') || this.ip;
    this.crNumber = params.get('cr') || this.crNumber;
    this.hostId = params.get('hostId') || 'host-dev-1';
    this.crId = params.get('crId') || 'cr-test-1';
    this.reconnectSessionId = params.get('sessionId') || '';
    this.titleService.setTitle(`${this.osUser}@${this.ip} - DenDenMushi SSH`);

    this.loadSettings();

    this.term = new Terminal({
      fontFamily: this.settings.fontFamily,
      fontSize: this.settings.fontSize,
      cursorStyle: this.settings.cursorStyle,
      cursorBlink: this.settings.cursorBlink,
      scrollback: this.settings.scrollback,
      theme: THEMES[this.settings.theme],
      // Disable the screen-reader textarea layer. xterm sets onfocus/onblur as
      // HTML attributes on the accessibility element, which violates strict CSP.
      screenReaderMode: false,
    });
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.terminalHost.nativeElement);
    this.fitAddon.fit();
    window.addEventListener('resize', this.resizeHandler);

    const host = this.terminalHost.nativeElement;
    host.addEventListener('mouseup', this.terminalMouseUpHandler);
    host.addEventListener('auxclick', this.terminalAuxClickHandler);

    this.term.onData((data) => this.sendInput(data));
    this.term.onBell(() => this.ringBell());
    this.term.attachCustomKeyEventHandler((event) => this.handleTerminalKeyEvent(event));

    this.connect();
    this.term.focus();
    this.cd.detectChanges();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.terminalHost?.nativeElement.removeEventListener('mouseup', this.terminalMouseUpHandler);
    this.terminalHost?.nativeElement.removeEventListener('auxclick', this.terminalAuxClickHandler);
    this.ws?.close();
    this.term?.dispose();
  }

  // --- Connection lifecycle ---

  private connect(): void {
    this.connecting = true;
    this.connectionError = '';
    this.writeLine(`Connecting to ${this.hostname} (${this.ip})...`);
    this.logEvent(`Session requested as ${this.osUser}@${this.ip} (${this.crNumber})`);

    if (this.reconnectSessionId) {
      // UC: Reconnect Session — ask the gateway for a fresh WebSocket ticket
      // via POST /sessions/{id}/rejoin (gateway spec).
      this.http
        .post<{ websocketUrl: string; sessionToken: string }>(
          apiPath(`sessions/${this.reconnectSessionId}/rejoin`),
          {},
        )
        .subscribe({
          next: (session) => this.openWebSocket(session.websocketUrl, session.sessionToken),
          error: () => {
            // Gateway session no longer rejoinable; start a fresh one
            this.logEvent('Rejoin failed — starting new session');
            this.reconnectSessionId = '';
            this.startNewSession();
          },
        });
    } else {
      this.startNewSession();
    }
  }

  private startNewSession(): void {
    this.http
      .post<{ websocketUrl: string; sessionToken: string; sessionId: string }>(
        apiPath('sessions/start'),
        {
          hostId: this.hostId,
          crId: this.crId,
          // osUser is kept for audit logging in the platform DB but is NOT
          // forwarded to the gateway (per gateway API spec).
          osUser: this.osUser,
          connectionType: 'ssh',
        },
      )
      .subscribe({
        next: (session) => {
          this.reconnectSessionId = session.sessionId ?? '';
          this.openWebSocket(session.websocketUrl, session.sessionToken);
        },
        error: (err) => {
          const msg: string =
            err?.error?.message ?? err?.message ?? 'Session start failed';
          this.connectionError = msg;
          this.connecting = false;
          this.writeLine(`\x1b[31mError: ${msg}\x1b[0m`);
          this.logEvent(`Connection failed: ${msg}`);
          this.cd.detectChanges();
        },
      });
  }

  private openWebSocket(url: string, token: string): void {
    const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.connecting = false;
      this.connectionError = '';
      this.logEvent(`WebSocket open: ${this.osUser}@${this.ip} (${this.crNumber})`);
      this.sendResize();
      this.cd.detectChanges();
    };

    ws.onmessage = (event: MessageEvent) => {
      const packet = new Uint8Array(event.data as ArrayBuffer);
      if (packet.length < 1) return;

      const payload = packet.slice(1);
      switch (packet[0]) {
        case PktType.Output:
          if (payload.length > 0) {
            this.term.write(new TextDecoder().decode(payload));
          }
          break;
        case PktType.Error: {
          const msg = new TextDecoder().decode(payload);
          this.writeLine(`\x1b[31m${msg}\x1b[0m`);
          this.logEvent(`Server error: ${msg}`);
          break;
        }
        case PktType.SessionEvent:
          this.logEvent(new TextDecoder().decode(payload));
          break;
      }
    };

    ws.onerror = () => {
      this.connectionError = 'WebSocket error';
      this.logEvent('WebSocket error');
      this.cd.detectChanges();
    };

    ws.onclose = (event: CloseEvent) => {
      this.connected = false;
      this.connecting = false;
      this.ws = null;
      const reason = event.reason ? ` (${event.reason})` : '';
      this.writeLine(`\r\n\x1b[33mConnection closed${reason}.\x1b[0m`);
      this.logEvent(`WebSocket closed: code=${event.code}${reason}`);
      // Notify backend so session state is updated (if not explicitly ended)
      if (event.code !== 1000) {
        this.notifyDisconnected();
      }
      this.cd.detectChanges();
    };
  }

  reconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.term.reset();
    this.logEvent('Reconnect requested');
    this.connect();
    this.term.focus();
  }

  /** Called when the WebSocket closes unexpectedly to mark the session disconnected. */
  private notifyDisconnected(): void {
    if (!this.reconnectSessionId) return;
    this.http
      .patch(apiPath(`sessions/${this.reconnectSessionId}/disconnect`), {})
      .subscribe({ error: () => {} });
  }

  private writeLine(text: string): void {
    this.term.writeln(text);
    this.sessionLog.push(text);
  }

  /** Send raw terminal input to the WebSocket as a binary packet. */
  private sendInput(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const dataBytes = this.encoder.encode(data);
    const packet = new Uint8Array(1 + dataBytes.length);
    packet[0] = PktType.Input;
    packet.set(dataBytes, 1);
    this.ws.send(packet.buffer);
  }

  /** Inform the server of the current terminal dimensions (big-endian cols + rows). */
  private sendResize(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const cols = this.term.cols;
    const rows = this.term.rows;
    const packet = new Uint8Array(5);
    packet[0] = PktType.Resize;
    packet[1] = (cols >> 8) & 0xff;
    packet[2] = cols & 0xff;
    packet[3] = (rows >> 8) & 0xff;
    packet[4] = rows & 0xff;
    this.ws.send(packet.buffer);
  }

  private ringBell(): void {
    if (!this.settings.visualBell) {
      return;
    }
    this.bellFlash = true;
    this.cd.detectChanges();
    setTimeout(() => {
      this.bellFlash = false;
      this.cd.detectChanges();
    }, 150);
  }

  // --- PuTTY-style selection, copy, and paste ---

  /** Copy selection if present; otherwise copy the full scrollback. */
  copy(): void {
    if (this.term.hasSelection()) {
      this.copySelection(false);
      return;
    }
    this.copyAll();
  }

  copySelection(clearAfter = false): void {
    const text = this.term.getSelection();
    if (!text) {
      return;
    }
    this.writeClipboard(text, 'Copied selection to clipboard', clearAfter);
  }

  copyAll(): void {
    this.term.selectAll();
    const content = this.term.getSelection();
    this.writeClipboard(content, 'Copied all terminal output to clipboard', true);
  }

  pasteFromClipboard(): void {
    navigator.clipboard.readText().then((text) => {
      if (text) {
        this.pasteText(text);
      }
    }).catch(() => {});
  }

  onContextMenu(event: MouseEvent): boolean {
    if (event.shiftKey && this.term.hasSelection()) {
      event.preventDefault();
      this.copySelection(false);
      return false;
    }
    if (this.settings.rightClickPaste) {
      event.preventDefault();
      this.pasteFromClipboard();
      return false;
    }
    return true;
  }

  private pasteText(text: string): void {
    this.sendInput(text);
    this.logEvent('Pasted from clipboard');
  }

  private onTerminalMouseUp(event: MouseEvent): void {
    if (event.button !== 0 || !this.settings.copyOnSelect) {
      return;
    }
    if (this.term.hasSelection()) {
      this.copySelection(false);
    }
  }

  private onTerminalAuxClick(event: MouseEvent): void {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    this.pasteFromClipboard();
  }

  /** PuTTY-style shortcuts: Ctrl+Shift+C/V, Ctrl+Insert, Shift+Insert. */
  private handleTerminalKeyEvent(event: KeyboardEvent): boolean {
    if (event.type !== 'keydown') {
      return true;
    }

    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;

    if (mod && event.shiftKey && key.toLowerCase() === 'c') {
      event.preventDefault();
      this.copySelection(false);
      return false;
    }
    if (mod && event.shiftKey && key.toLowerCase() === 'v') {
      event.preventDefault();
      this.pasteFromClipboard();
      return false;
    }
    if (event.ctrlKey && key === 'Insert') {
      event.preventDefault();
      this.copySelection(false);
      return false;
    }
    if (event.shiftKey && key === 'Insert' && !event.ctrlKey) {
      event.preventDefault();
      this.pasteFromClipboard();
      return false;
    }

    return true;
  }

  private writeClipboard(text: string, logMessage: string, clearSelection: boolean): void {
    navigator.clipboard.writeText(text).then(() => {
      this.logEvent(logMessage);
      if (clearSelection) {
        this.term.clearSelection();
      }
    }).catch(() => {});
  }

  clearScrollback(): void {
    this.term.clear();
    this.logEvent('Scrollback cleared');
  }

  resetTerminal(): void {
    this.term.reset();
    this.logEvent('Terminal reset');
    this.term.focus();
  }

  downloadLog(): void {
    const header = [
      `DenDenMushi Web SSH session log`,
      `Session: ${this.osUser}@${this.hostname} (${this.ip})`,
      `Change request: ${this.crNumber}`,
      `Saved: ${new Date().toLocaleString()}`,
      ''.padEnd(60, '='),
    ];
    const blob = new Blob([[...header, ...this.sessionLog].join('\r\n')], {
      type: 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.hostname}-${this.osUser}-${Date.now()}.log`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    this.logEvent('Session log downloaded');
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  // --- Settings ---

  applySettings(): void {
    this.term.options.fontFamily = this.settings.fontFamily;
    this.term.options.fontSize = this.settings.fontSize;
    this.term.options.cursorStyle = this.settings.cursorStyle;
    this.term.options.cursorBlink = this.settings.cursorBlink;
    this.term.options.scrollback = this.settings.scrollback;
    this.term.options.theme = THEMES[this.settings.theme];
    this.fitAddon.fit();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    this.logEvent('Settings changed');
  }

  restoreDefaultSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.applySettings();
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private logEvent(message: string): void {
    this.eventLog.push({ when: new Date().toLocaleTimeString(), message });
  }
}
