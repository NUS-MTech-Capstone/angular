import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { icons } from '../../icons-provider';
import { ChangeRequestService } from '../../services/change-request.service';
import { ImplementerGroupService } from '../../services/implementer-group.service';
import { SessionsApiService } from '../../services/sessions.service';
import { AuthService } from '../../services/auth.service';
import { Access } from './access';

describe('Access', () => {
  let component: Access;
  let fixture: ComponentFixture<Access>;
  let changeRequestService: { findAccessible: ReturnType<typeof vi.fn> };
  let implementerGroupService: { findAccessibleVms: ReturnType<typeof vi.fn> };
  let sessionsApi: {
    listActive: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    changeRequestService = {
      findAccessible: vi.fn(() => of([])),
    };
    implementerGroupService = {
      findAccessibleVms: vi.fn(() =>
        of({ implementerGroups: [], osUsers: [], vms: [] }),
      ),
    };
    sessionsApi = {
      listActive: vi.fn(() => of([])),
      end: vi.fn(() => of({ id: 's1', status: 'ended' })),
    };

    await TestBed.configureTestingModule({
      imports: [Access],
      providers: [
        provideNzIcons(icons),
        { provide: ChangeRequestService, useValue: changeRequestService },
        { provide: ImplementerGroupService, useValue: implementerGroupService },
        { provide: SessionsApiService, useValue: sessionsApi },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: AuthService,
          useValue: {
            user: vi.fn(() => ({ username: 'testuser' })),
            hasPermission: vi.fn(() => true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Access);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load accessible servers and change requests on init', () => {
    expect(implementerGroupService.findAccessibleVms).toHaveBeenCalled();
    expect(changeRequestService.findAccessible).toHaveBeenCalled();
  });

  it('loads active sessions when Sessions section is selected', () => {
    component.selectSection('Sessions');
    expect(sessionsApi.listActive).toHaveBeenCalled();
  });

  it('identifies sessions owned by the current user', () => {
    expect(component.isMySession({ createdBy: 'testuser' } as never)).toBe(true);
    expect(component.isMySession({ createdBy: 'other.user' } as never)).toBe(false);
  });

  it('maps session status to tag colors', () => {
    expect(component.sessionStatusColor('active')).toBe('green');
    expect(component.sessionStatusColor('disconnected')).toBe('orange');
    expect(component.sessionStatusColor('ended')).toBe('default');
  });

  it('ends a backend session via SessionsApiService', () => {
    const session = {
      id: 's1',
      hostname: 'web01',
      createdBy: 'testuser',
    } as never;

    component.endBackendSession(session);

    expect(sessionsApi.end).toHaveBeenCalledWith('s1');
  });

  it('opens a terminal window with server and change-request context', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const server = {
      vmId: 'vm-1',
      hostname: 'host-dev-1',
      ipAddress: '10.0.10.203',
      selectedOsUser: 'ec2-user',
    } as never;

    component.launchNew(server);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('/terminal?'),
      '_blank',
      'popup=yes,width=1200,height=760',
    );
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('user=ec2-user');
    expect(url).toContain('host=host-dev-1');
    expect(url).toContain('hostId=vm-1');
    openSpy.mockRestore();
  });
});
