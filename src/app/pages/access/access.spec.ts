import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
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
    list: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let authService: {
    user: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
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
      list: vi.fn(() => of({ sessions: [] })),
      close: vi.fn(() => of({ sessionId: 'gateway-session-1', status: 'CLOSED' })),
    };
    authService = {
      user: vi.fn(() => ({ username: 'testuser', sub: 'user-sub' })),
      hasPermission: vi.fn(() => true),
    };

    await TestBed.configureTestingModule({
      imports: [Access],
      providers: [
        provideNzIcons(icons),
        { provide: ChangeRequestService, useValue: changeRequestService },
        { provide: ImplementerGroupService, useValue: implementerGroupService },
        { provide: SessionsApiService, useValue: sessionsApi },
        { provide: AuthService, useValue: authService },
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
    expect(sessionsApi.list).toHaveBeenCalledWith({ status: 'ACTIVE' });
  });

  it('identifies sessions owned by the current user', () => {
    expect(component.isMySession({ userId: 'user-sub' } as never)).toBe(true);
    expect(component.isMySession({ userId: 'other-user' } as never)).toBe(false);
  });

  it('maps session status to tag colors', () => {
    expect(component.sessionStatusColor('ACTIVE')).toBe('green');
    expect(component.sessionStatusColor('CLOSED')).toBe('default');
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
    expect(url).toContain('hostId=host-dev-1');
    openSpy.mockRestore();
  });

  it('opens owner rejoin with the gateway session id', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    component.reconnectGatewaySession({
      sessionId: 'gateway-session-1',
      hostId: 'host-dev-1',
      crId: 'cr-1',
      connectionType: 'ssh',
      status: 'ACTIVE',
      createdAt: '2026-06-18T00:00:00.000Z',
      lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
      leaseExpiresAt: '2026-06-18T00:06:00.000Z',
    } as never);

    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('sessionId=gateway-session-1');
    expect(url).toContain('mode=rejoin');
    openSpy.mockRestore();
  });

  it('opens non-owner observe with the gateway session id', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    component.observeGatewaySession({
      sessionId: 'gateway-session-1',
      hostId: 'host-dev-1',
      crId: 'cr-1',
      connectionType: 'ssh',
      status: 'ACTIVE',
      createdAt: '2026-06-18T00:00:00.000Z',
      lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
      leaseExpiresAt: '2026-06-18T00:06:00.000Z',
    } as never);

    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('sessionId=gateway-session-1');
    expect(url).toContain('mode=observe');
    openSpy.mockRestore();
  });

  it('opens owner observe with the gateway session id', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    component.observeGatewaySession({
      sessionId: 'gateway-session-1',
      userId: 'user-sub',
      hostId: 'host-dev-1',
      crId: 'cr-1',
      connectionType: 'ssh',
      status: 'ACTIVE',
      createdAt: '2026-06-18T00:00:00.000Z',
      lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
      leaseExpiresAt: '2026-06-18T00:06:00.000Z',
    } as never);

    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('sessionId=gateway-session-1');
    expect(url).toContain('mode=observe');
    openSpy.mockRestore();
  });

  it('does not require view permission for observe session actions', () => {
    authService.hasPermission.mockReturnValue(false);

    expect(component.canUseSessionAction({ primaryAction: 'Observe' } as never)).toBe(true);
    expect(component.canUseSessionAction({ primaryAction: 'Rejoin' } as never)).toBe(false);
  });

  it('wires watch to the observe terminal route', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const server = {
      hostname: 'host-dev-1',
      ipAddress: '10.0.10.203',
    } as never;
    const session = {
      osUser: 'ec2-user',
      crNumber: 'CR-1',
      crId: 'cr-1',
      sessionId: 'gateway-session-1',
    } as never;

    component.watchSession(server, session);

    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('sessionId=gateway-session-1');
    expect(url).toContain('mode=observe');
    openSpy.mockRestore();
  });

  it('loads CR-scoped gateway sessions and wires Watch with the real session id', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    sessionsApi.list.mockClear();
    sessionsApi.list.mockReturnValue(
      of({
        sessions: [
          {
            sessionId: 'gateway-session-cr-1',
            userId: 'owner-sub',
            hostId: 'host-dev-1',
            crId: 'cr-1',
            connectionType: 'ssh',
            status: 'ACTIVE',
            createdAt: '2026-06-18T00:00:00.000Z',
            lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
            leaseExpiresAt: '2026-06-18T00:06:00.000Z',
          },
          {
            sessionId: 'other-cr-session',
            userId: 'owner-sub',
            hostId: 'host-dev-1',
            crId: 'cr-2',
            connectionType: 'ssh',
            status: 'ACTIVE',
            createdAt: '2026-06-18T00:00:00.000Z',
            lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
            leaseExpiresAt: '2026-06-18T00:06:00.000Z',
          },
          {
            sessionId: 'other-host-session',
            userId: 'owner-sub',
            hostId: 'host-dev-2',
            crId: 'cr-1',
            connectionType: 'ssh',
            status: 'ACTIVE',
            createdAt: '2026-06-18T00:00:00.000Z',
            lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
            leaseExpiresAt: '2026-06-18T00:06:00.000Z',
          },
        ],
      }),
    );
    component.accessibleRequests = [
      {
        id: 'cr-1',
        title: 'Patch host',
        description: 'Patch host-dev-1',
        requester: 'requester',
        approvalRoute: 'standard',
        status: 'Approved',
        createdAt: '2026-06-18T00:00:00.000Z',
        history: [],
        activities: [],
        vmIds: ['vm-1'],
        allowedRoles: [],
        implementerGroupIds: [],
        implementationStartAt: '2026-06-18T00:00:00.000Z',
        implementationEndAt: '2026-06-18T01:00:00.000Z',
        osUsers: ['ec2-user'],
        implementerGroups: [],
        vms: [
          {
            id: 'vm-1',
            hostname: 'host-dev-1',
            ipAddress: '10.0.10.203',
            assetStatus: 'Active',
            osVersion: 'RHEL',
            sshPort: 22,
            tags: [],
            createdAt: '2026-06-18T00:00:00.000Z',
            updatedAt: '2026-06-18T00:00:00.000Z',
          },
        ],
      },
    ];

    component.selectSection('Change Requests');

    expect(sessionsApi.list).toHaveBeenCalledWith({ status: 'ACTIVE' });
    expect(component.crServers[0].sessions).toHaveLength(1);
    expect(component.crServers[0].sessions[0].sessionId).toBe('gateway-session-cr-1');

    component.watchSession(component.crServers[0], component.crServers[0].sessions[0]);

    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('sessionId=gateway-session-cr-1');
    expect(url).toContain('mode=observe');
    openSpy.mockRestore();
  });

  it('enables Stop for owned sessions and users with access.stop', () => {
    authService.hasPermission.mockImplementation((permission: string) => permission === 'access.stop');

    const owned = component['gatewayToActiveSession']({
      sessionId: 'gateway-session-1',
      userId: 'user-sub',
      hostId: 'host-dev-1',
      crId: 'cr-1',
      connectionType: 'ssh',
      status: 'ACTIVE',
      createdAt: '2026-06-18T00:00:00.000Z',
      lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
      leaseExpiresAt: '2026-06-18T00:06:00.000Z',
    } as never);
    const other = component['gatewayToActiveSession']({
      sessionId: 'gateway-session-2',
      userId: 'other-sub',
      hostId: 'host-dev-1',
      crId: 'cr-1',
      connectionType: 'ssh',
      status: 'ACTIVE',
      createdAt: '2026-06-18T00:00:00.000Z',
      lastHeartbeatAt: '2026-06-18T00:01:00.000Z',
      leaseExpiresAt: '2026-06-18T00:06:00.000Z',
    } as never);

    expect(owned.canStop).toBe(true);
    expect(other.canStop).toBe(true);
  });

  it('calls gateway close when stopping a session', () => {
    const session = {
      sessionId: 'gateway-session-1',
      crNumber: 'CR-1',
      crId: 'cr-1',
      createdBy: 'owner-sub',
      lastActivity: 'Active',
      osUser: 'ec2-user',
      currentImplementor: 'owner-sub',
      primaryAction: 'Rejoin' as const,
      primaryEnabled: true,
      canStop: true,
      canWatch: true,
      gatewayHostId: 'host-dev-1',
    };
    const server = {
      vmId: 'vm-1',
      hostname: 'host-dev-1',
      sessions: [session],
    } as never;

    component.stopSession(server, session as never);

    expect(sessionsApi.close).toHaveBeenCalledWith('gateway-session-1');
    expect((server as { sessions: unknown[] }).sessions).toHaveLength(0);
  });
});
