import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { apiPath } from '../../core/api.constants';
import { icons } from '../../icons-provider';
import { TerminalPage } from './terminal';

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    loadAddon = vi.fn();
    open = vi.fn();
    onData = vi.fn();
    onSelectionChange = vi.fn();
    onBell = vi.fn();
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
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
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

describe('TerminalPage', () => {
  let component: TerminalPage;
  let fixture: ComponentFixture<TerminalPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    MockWebSocket.instances = [];
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

    const req = httpMock.expectOne(apiPath('sessions/start'));
    req.flush({
      websocketUrl: 'wss://gateway.test/ws',
      sessionToken: 'session-token',
      sessionId: 'session-1',
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
});
