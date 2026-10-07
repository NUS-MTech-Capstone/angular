import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  CSP_NONCE,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
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
import { API_VERSION, gatewayPath } from '../../core/api.constants';
import { withStyleNonce } from '../../core/style-nonce-document';

/** Binary terminal protocol — must match proxy-dataplane/internal/protocol/packet.go */
const enum PktType {
  Input = 0x00,
  Output = 0x01,
  Error = 0x02,
  SessionEvent = 0x07,
  Resize = 0x10,
  Heartbeat = 0x11,
  ClientClose = 0x12,
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

interface AttachmentEvent {
  type: 'attachments';
  observers: string[];
}

const SETTINGS_STORAGE_KEY = 'ddm-terminal-settings';
const HEARTBEAT_INTERVAL_MS = 30_000;
const TERMINAL_IDLE_TIMEOUT_MS = 15 * 60_000;

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
  sessionAccessMode: 'rejoin' | 'observe' = 'rejoin';

  connected = false;
  connecting = false;
  connectionError = '';
  bellFlash = false;
  isSettingsOpen = false;
  isEventLogOpen = false;
  /** Live observer list from dataplane attachment snapshots (0x07 JSON events). */
  observerUserIds = signal<string[]>([]);

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
  private connectionTimer: ReturnType<typeof setInterval> | null = null;
  private lastTerminalActivityAt = 0;
  private terminalMouseUpHandler = (event: MouseEvent) => this.onTerminalMouseUp(event);
  private terminalAuxClickHandler = (event: MouseEvent) => this.onTerminalAuxClick(event);
  private resizeHandler = () => {
    this.fitAddon.fit();
    this.sendResize();
  };

  get isObserverMode(): boolean {
    return this.sessionAccessMode === 'observe';
  }

  constructor(
    private route: ActivatedRoute,
    private titleService: Title,
    private cd: ChangeDetectorRef,
    private http: HttpClient,
  ) {}

  private readonly cspNonce = inject(CSP_NONCE);
  private readonly browserDocument = inject(DOCUMENT);

  ngAfterViewInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.osUser = params.get('user') || this.osUser;
    this.hostname = params.get('host') || this.hostname;
    this.ip = params.get('ip') || this.ip;
    this.crNumber = params.get('cr') || this.crNumber;
    this.hostId = params.get('hostId') || 'host-dev-1';
    this.crId = params.get('crId') || 'cr-test-1';
    this.reconnectSessionId = params.get('sessionId') || '';
    this.sessionAccessMode = params.get('mode') === 'observe' ? 'observe' : 'rejoin';
    this.titleService.setTitle(`${this.osUser}@${this.ip} - DenDenMushi SSH`);

    this.loadSettings();

    this.term = new Terminal({
      documentOverride: withStyleNonce(this.browserDocument, this.cspNonce),
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
    this.stopConnectionTimer();
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
      // UC: Reconnect/Observe Session — ask the gateway for a fresh
      // WebSocket ticket using the gateway session ID from the route.
      const action = this.sessionAccessMode === 'observe' ? 'observe' : 'rejoin';
      this.http
        .post<{ websocketUrl: string; sessionToken: string }>(
          gatewayPath(`sessions/${this.reconnectSessionId}/${action}`),
          {},
        )
        .subscribe({
          next: (session) => this.openWebSocket(session.websocketUrl, session.sessionToken),
          error: (err) => {
            const msg: string =
              err?.error?.message ?? err?.message ?? `${action} failed`;
            this.connectionError = msg;
            this.connecting = false;
            this.writeLine(`\x1b[31mError: ${msg}\x1b[0m`);
            this.logEvent(`${action} failed: ${msg}`);
            this.cd.detectChanges();
          },
        });
    } else {
      this.startNewSession();
    }
  }

  private startNewSession(): void {
    this.http
      .post<{ websocketUrl: string; sessionToken: string; sessionId: string }>(
        gatewayPath('sessions/start'),
        {
          hostId: this.hostId,
          crId: this.crId,
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
    const requestId = crypto.randomUUID();
    const separator = url.includes('?') ? '&' : '?';
    const wsUrl = `${url}${separator}token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}&apiVersion=${encodeURIComponent(API_VERSION)}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.connecting = false;
      this.connectionError = '';
      this.logEvent(`WebSocket open: ${this.osUser}@${this.ip} (${this.crNumber})`);
      this.recordTerminalActivity();
      this.startConnectionTimer();
      this.sendResize();
      this.cd.detectChanges();
    };

    ws.onmessage = (event: MessageEvent) => {
      void this.handleWebSocketMessage(event.data);
    };

    ws.onerror = () => {
      this.connectionError = 'WebSocket error';
      this.logEvent('WebSocket error');
      this.cd.detectChanges();
    };

    ws.onclose = (event: CloseEvent) => {
      this.stopConnectionTimer();
      this.connected = false;
      this.connecting = false;
      this.ws = null;
      const reason = event.reason ? ` (${event.reason})` : '';
      this.writeLine(`\r\n\x1b[33mConnection closed${reason}.\x1b[0m`);
      this.logEvent(`WebSocket closed: code=${event.code}${reason}`);
      this.cd.detectChanges();
    };
  }

  reconnect(): void {
    this.stopConnectionTimer();
    this.ws?.close();
    this.ws = null;
    this.term.reset();
    this.logEvent('Reconnect requested');
    this.connect();
    this.term.focus();
  }

  private writeLine(text: string): void {
    this.term.writeln(text);
    this.sessionLog.push(text);
  }

  /** Send raw terminal input to the WebSocket as a binary packet. */
  private sendInput(data: string): void {
    if (this.isObserverMode) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const dataBytes = this.encoder.encode(data);
    const packet = new Uint8Array(1 + dataBytes.length);
    packet[0] = PktType.Input;
    packet.set(dataBytes, 1);
    this.ws.send(packet.buffer);
    this.recordTerminalActivity();
  }

  /** Inform the server of the current terminal dimensions (big-endian cols + rows). */
  private sendResize(): void {
    if (this.isObserverMode) return;
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
    this.recordTerminalActivity();
  }

  private startConnectionTimer(): void {
    this.stopConnectionTimer();
    this.connectionTimer = setInterval(() => {
      if (Date.now() - this.lastTerminalActivityAt >= TERMINAL_IDLE_TIMEOUT_MS) {
        this.detachForIdleTimeout();
        return;
      }
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopConnectionTimer(): void {
    if (this.connectionTimer !== null) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private sendHeartbeat(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(new Uint8Array([PktType.Heartbeat]).buffer);
  }

  private recordTerminalActivity(): void {
    this.lastTerminalActivityAt = Date.now();
  }

  private detachForIdleTimeout(): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    this.stopConnectionTimer();
    const message = 'Disconnected after 15 minutes of inactivity. Rejoin to continue.';
    this.connectionError = message;
    this.writeLine(`\r\n\x1b[33m${message}\x1b[0m`);
    this.logEvent('WebSocket detached after 15 minutes of inactivity');
    ws.send(new Uint8Array([PktType.ClientClose]).buffer);
    ws.close(1000, 'idle timeout');
    this.cd.detectChanges();
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
    if (this.isObserverMode) {
      this.logEvent('Paste ignored in observer mode');
      return;
    }
    this.sendInput(text);
    this.logEvent('Pasted from clipboard');
  }

  private handleSessionEvent(message: string): void {
    const attachmentEvent = this.parseAttachmentEvent(message);
    if (attachmentEvent) {
      this.observerUserIds.set(attachmentEvent.observers);
      const label = attachmentEvent.observers.length
        ? attachmentEvent.observers.join(', ')
        : 'none';
      this.logEvent(`Observers: ${label}`);
      this.cd.detectChanges();
      return;
    }
    this.logEvent(message);
    this.cd.detectChanges();
  }

  private async handleWebSocketMessage(data: unknown): Promise<void> {
    const packet = await this.readPacket(data);
    if (!packet || packet.length < 1) return;

    const payload = packet.slice(1);
    switch (packet[0]) {
      case PktType.Output:
        if (payload.length > 0) {
          this.term.write(new TextDecoder().decode(payload));
          this.recordTerminalActivity();
        }
        break;
      case PktType.Error: {
        const msg = new TextDecoder().decode(payload);
        this.writeLine(`\x1b[31m${msg}\x1b[0m`);
        this.logEvent(`Server error: ${msg}`);
        this.cd.detectChanges();
        break;
      }
      case PktType.SessionEvent:
        this.handleSessionEvent(new TextDecoder().decode(payload));
        break;
    }
  }

  /** Normalize WebSocket binary payloads (ArrayBuffer or Blob). */
  private async readPacket(data: unknown): Promise<Uint8Array | null> {
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (data instanceof Blob) {
      return new Uint8Array(await data.arrayBuffer());
    }
    return null;
  }

  private parseAttachmentEvent(message: string): AttachmentEvent | null {
    try {
      const parsed = JSON.parse(message) as Partial<AttachmentEvent>;
      if (
        parsed.type === 'attachments' &&
        Array.isArray(parsed.observers) &&
        parsed.observers.every((observer) => typeof observer === 'string')
      ) {
        return { type: 'attachments', observers: parsed.observers };
      }
    } catch {
      return null;
    }
    return null;
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
