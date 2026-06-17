import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { TerminalPage } from './terminal';

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    loadAddon = vi.fn();
    open = vi.fn();
    onData = vi.fn();
    onSelectionChange = vi.fn();
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

describe('TerminalPage', () => {
  let component: TerminalPage;
  let fixture: ComponentFixture<TerminalPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminalPage],
      providers: [
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
    fixture.detectChanges();
    await fixture.whenStable();
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
