import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { gatewayPath } from '../../core/api.constants';
import { icons } from '../../icons-provider';
import { TerminalPage } from './terminal';

let lastTerm: {
  cols: number;
  rows: number;
  loadAddon: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  onData: ReturnType<typeof vi.fn>;
  attachCustomKeyEventHandler: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  writeln: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  hasSelection: ReturnType<typeof vi.fn>;
  getSelection: ReturnType<typeof vi.fn>;
  selectAll: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  options: Record<string, unknown>;
};
let keyHandler: ((event: KeyboardEvent) => boolean) | undefined;
let onDataHandler: ((data: string) => void) | undefined;

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 120;
    rows = 40;
    loadAddon = vi.fn();
    open = vi.fn();
    onData = vi.fn((handler: (data: string) => void) => {
      onDataHandler = handler;
    });
    onSelectionChange = vi.fn();
    onBell = vi.fn();
    attachCustomKeyEventHandler = vi.fn((handler: (event: KeyboardEvent) => boolean) => {
      keyHandler = handler;
    });
    focus = vi.fn();
    dispose = vi.fn();
    write = vi.fn();
    writeln = vi.fn();
    reset = vi.fn();
    clear = vi.fn();
    hasSelection = vi.fn(() => false);
    getSelection = vi.fn(() => '');
    selectAll = vi.fn();
    clearSelection = vi.fn();
    options = {};

    constructor() {
      lastTerm = this;
    }
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.OPEN;
  binaryType = 'arraybuffer';
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  close = vi.fn();
  send = vi.fn();
}

function flushSessionStart(
  httpMock: HttpTestingController,
  onRequest?: (body: unknown) => void,
): void {
  const req = httpMock.expectOne(gatewayPath('sessions/start'));
  onRequest?.(req.request.body);
  req.flush({
    websocketUrl: 'wss://gateway.test/ws',
    sessionToken: 'session-token',
    sessionId: 'session-1',
  });
}

function openMockWebSocket(): MockWebSocket {
  const ws = MockWebSocket.instances[0];
  ws.onopen?.();
  return ws;
}

describe('TerminalPage', () => {
  let component: TerminalPage;
  let fixture: ComponentFixture<TerminalPage>;
  let httpMock: HttpTestingController;
  let sessionStartBody: unknown;

  beforeEach(async () => {
    MockWebSocket.instances = [];
    keyHandler = undefined;
    onDataHandler = undefined;
    vi.stubGlobal('WebSocket', MockWebSocket);

    await TestBed.configureTestingModule({
      imports: [TerminalPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: vi.fn((key: string) => {
                  const params: Record<string, string> = {
                    user: 'testuser',
                    host: 'test-host',
                    ip: '10.0.0.1',
                    cr: 'CR-TEST',
                    hostId: 'vm-uuid-1',
                    crId: 'cr-test-1',
                  };
                  return params[key] ?? null;
                }),
              },
            },
          },
        },
        { provide: Title, useValue: { setTitle: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminalPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    flushSessionStart(httpMock, (body) => {
      sessionStartBody = body;
    });
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should read connection params from query string', () => {
    expect(component.osUser).toBe('testuser');
    expect(component.hostname).toBe('test-host');
    expect(component.ip).toBe('10.0.0.1');
    expect(component.crNumber).toBe('CR-TEST');
  });

  it('posts hostId and crId when starting a session', () => {
    expect(sessionStartBody).toEqual({
      hostId: 'vm-uuid-1',
      crId: 'cr-test-1',
      connectionType: 'ssh',
    });
  });

  it('sends a resize packet when the WebSocket opens', () => {
    const ws = openMockWebSocket();
    expect(component.connected).toBe(true);

    const packet = new Uint8Array(ws.send.mock.calls[0][0] as ArrayBuffer);
    expect(packet[0]).toBe(0x10);
    expect(packet[1]).toBe(0);
    expect(packet[2]).toBe(120);
    expect(packet[3]).toBe(0);
    expect(packet[4]).toBe(40);
  });

  it('sends terminal input as binary input packets', () => {
    const ws = openMockWebSocket();
    onDataHandler?.('ls\r');

    const packet = new Uint8Array(ws.send.mock.calls[1][0] as ArrayBuffer);
    expect(packet[0]).toBe(0x00);
    expect(new TextDecoder().decode(packet.slice(1))).toBe('ls\r');
  });

  it('writes server output packets to xterm', async () => {
    const ws = openMockWebSocket();
    const payload = new TextEncoder().encode('hello world');
    const packet = new Uint8Array(1 + payload.length);
    packet[0] = 0x01;
    packet.set(payload, 1);
    ws.onmessage?.({ data: packet.buffer } as MessageEvent);
    await Promise.resolve();

    expect(lastTerm.write).toHaveBeenCalledWith('hello world');
  });

  it('updates observer list from structured session events', async () => {
    const ws = openMockWebSocket();
    const payload = new TextEncoder().encode(
      JSON.stringify({ type: 'attachments', observers: ['observer-1', 'observer-2'] }),
    );
    const packet = new Uint8Array(1 + payload.length);
    packet[0] = 0x07;
    packet.set(payload, 1);
    ws.onmessage?.({ data: packet.buffer } as MessageEvent);
    await Promise.resolve();

    expect(component.observerUserIds()).toEqual(['observer-1', 'observer-2']);
    expect(component.eventLog.some((entry) => entry.message.includes('Observers: observer-1, observer-2'))).toBe(
      true,
    );
  });

  it('updates observer count after plain attach text followed by JSON snapshot', async () => {
    const ws = openMockWebSocket();
    const textPacket = new Uint8Array([0x07, ...new TextEncoder().encode('observer attached')]);
    ws.onmessage?.({ data: textPacket.buffer } as MessageEvent);
    await Promise.resolve();
    expect(component.observerUserIds()).toEqual([]);

    const snapshot = new TextEncoder().encode(
      JSON.stringify({ type: 'attachments', observers: ['observer-1'] }),
    );
    const snapshotPacket = new Uint8Array(1 + snapshot.length);
    snapshotPacket[0] = 0x07;
    snapshotPacket.set(snapshot, 1);
    ws.onmessage?.({ data: snapshotPacket.buffer } as MessageEvent);
    await Promise.resolve();

    expect(component.observerUserIds()).toEqual(['observer-1']);
  });

  it('logs server error packets and writes them to the terminal', async () => {
    const ws = openMockWebSocket();
    const payload = new TextEncoder().encode('permission denied');
    const packet = new Uint8Array(1 + payload.length);
    packet[0] = 0x02;
    packet.set(payload, 1);
    ws.onmessage?.({ data: packet.buffer } as MessageEvent);
    await Promise.resolve();

    expect(lastTerm.writeln).toHaveBeenCalledWith('\x1b[31mpermission denied\x1b[0m');
    expect(component.eventLog.some((entry) => entry.message.includes('Server error'))).toBe(
      true,
    );
  });

  it('copies selection with Ctrl+Shift+C', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText, readText: vi.fn() } });
    lastTerm.hasSelection.mockReturnValue(true);
    lastTerm.getSelection.mockReturnValue('selected text');

    const handled = keyHandler?.(
      new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, key: 'c' }),
    );

    expect(handled).toBe(false);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('selected text');
    });
    expect(component.eventLog.some((entry) => entry.message.includes('Copied selection'))).toBe(
      true,
    );
  });

  it('pastes from clipboard with Ctrl+Shift+V', async () => {
    const readText = vi.fn().mockResolvedValue('echo hi\n');
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(), readText } });
    const ws = openMockWebSocket();

    const handled = keyHandler?.(
      new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, key: 'v' }),
    );

    expect(handled).toBe(false);
    await vi.waitFor(() => {
      expect(readText).toHaveBeenCalled();
    });

    const packet = new Uint8Array(ws.send.mock.calls[1][0] as ArrayBuffer);
    expect(packet[0]).toBe(0x00);
    expect(new TextDecoder().decode(packet.slice(1))).toBe('echo hi\n');
  });

  it('surfaces session start failures', async () => {
    httpMock.verify();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TerminalPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: vi.fn(() => null),
              },
            },
          },
        },
        { provide: Title, useValue: { setTitle: vi.fn() } },
      ],
    }).compileComponents();

    const errorFixture = TestBed.createComponent(TerminalPage);
    errorFixture.detectChanges();

    const req = TestBed.inject(HttpTestingController).expectOne(gatewayPath('sessions/start'));
    req.flush({ message: 'STS denied' }, { status: 403, statusText: 'Forbidden' });
    await errorFixture.whenStable();

    expect(errorFixture.componentInstance.connectionError).toBe('STS denied');
    expect(errorFixture.componentInstance.connecting).toBe(false);
  });

  it('rejoins an existing session when sessionId is present', async () => {
    httpMock.verify();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];

    await TestBed.resetTestingModule();
    vi.stubGlobal('WebSocket', MockWebSocket);
    await TestBed.configureTestingModule({
      imports: [TerminalPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: vi.fn((key: string) => ({ sessionId: 'session-1' })[key] ?? null),
              },
            },
          },
        },
        { provide: Title, useValue: { setTitle: vi.fn() } },
      ],
    }).compileComponents();

    const rejoinFixture = TestBed.createComponent(TerminalPage);
    rejoinFixture.detectChanges();

    const testing = TestBed.inject(HttpTestingController);
    const req = testing.expectOne(gatewayPath('sessions/session-1/rejoin'));
    expect(req.request.method).toBe('POST');
    req.flush({ websocketUrl: 'wss://gateway.test/ws', sessionToken: 'fresh-token' });
    await rejoinFixture.whenStable();

    expect(MockWebSocket.instances[0].url).toContain('fresh-token');
    testing.verify();
  });

  it('observes an existing session when mode=observe is present', async () => {
    httpMock.verify();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];

    await TestBed.resetTestingModule();
    vi.stubGlobal('WebSocket', MockWebSocket);
    await TestBed.configureTestingModule({
      imports: [TerminalPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: vi.fn((key: string) =>
                  ({ sessionId: 'session-1', mode: 'observe' })[key] ?? null,
                ),
              },
            },
          },
        },
        { provide: Title, useValue: { setTitle: vi.fn() } },
      ],
    }).compileComponents();

    const observeFixture = TestBed.createComponent(TerminalPage);
    observeFixture.detectChanges();

    const testing = TestBed.inject(HttpTestingController);
    const req = testing.expectOne(gatewayPath('sessions/session-1/observe'));
    expect(req.request.method).toBe('POST');
    req.flush({ websocketUrl: 'wss://gateway.test/ws', sessionToken: 'observer-token' });
    await observeFixture.whenStable();

    expect(MockWebSocket.instances[0].url).toContain('observer-token');
    const ws = MockWebSocket.instances[0];
    ws.onopen?.();
    expect(ws.send).not.toHaveBeenCalled();
    onDataHandler?.('whoami\r');
    expect(ws.send).not.toHaveBeenCalled();
    testing.verify();
  });

  it('surfaces explicit rejoin failures without starting a new session', async () => {
    httpMock.verify();
    vi.unstubAllGlobals();
    MockWebSocket.instances = [];

    await TestBed.resetTestingModule();
    vi.stubGlobal('WebSocket', MockWebSocket);
    await TestBed.configureTestingModule({
      imports: [TerminalPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: vi.fn((key: string) => ({ sessionId: 'session-1' })[key] ?? null),
              },
            },
          },
        },
        { provide: Title, useValue: { setTitle: vi.fn() } },
      ],
    }).compileComponents();

    const rejoinFixture = TestBed.createComponent(TerminalPage);
    rejoinFixture.detectChanges();

    const testing = TestBed.inject(HttpTestingController);
    const req = testing.expectOne(gatewayPath('sessions/session-1/rejoin'));
    req.flush({ message: 'Only the original session owner can rejoin' }, { status: 403, statusText: 'Forbidden' });
    await rejoinFixture.whenStable();

    expect(rejoinFixture.componentInstance.connectionError).toBe(
      'Only the original session owner can rejoin',
    );
    testing.expectNone(gatewayPath('sessions/start'));
    expect(MockWebSocket.instances.length).toBe(0);
    testing.verify();
  });
});
