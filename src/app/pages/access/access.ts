import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { formatChangeRequestNumber } from '../../core/change-request.utils';
import { AuthService } from '../../services/auth.service';
import {
  AccessibleChangeRequest,
  ChangeRequestService,
} from '../../services/change-request.service';
import {
  ImplementerGroup,
  ImplementerGroupService,
} from '../../services/implementer-group.service';
import { GatewaySession, SessionsApiService } from '../../services/sessions.service';
import type { VirtualMachine } from '../../services/inventory.service';

interface ActiveSession {
  crNumber: string;
  crId: string;
  createdBy: string;
  lastActivity: string;
  osUser: string;
  currentImplementor: string;
  primaryAction: 'Rejoin' | 'Observe' | 'Request';
  primaryEnabled: boolean;
  canStop: boolean;
  canWatch: boolean;
  /** Gateway session ID assigned by Proxy Control Plane. */
  sessionId?: string;
  gatewayHostId: string;
}

interface AccessServer {
  vmId: string;
  hostname: string;
  ipAddress: string;
  assetStatus: string;
  osVersion: string;
  sshPort: number;
  expanded: boolean;
  osUsers: string[];
  selectedOsUser: string;
  sessions: ActiveSession[];
  implementerGroups: string[];
}

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAutocompleteModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzSpaceModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './access.html',
  styleUrls: ['./access.css'],
})
export class Access implements OnInit {
  private auth = inject(AuthService);
  private changeRequestService = inject(ChangeRequestService);
  private implementerGroupService = inject(ImplementerGroupService);
  private sessionsApi = inject(SessionsApiService);
  private cd = inject(ChangeDetectorRef);

  sections = ['Servers', 'Change Requests', 'Sessions', 'Proxies'];
  activeSection = 'Servers';
  isPanelCollapsed = false;
  crSearchTerm = '';
  serverSearchTerm = '';

  accessibleRequests: AccessibleChangeRequest[] = [];
  selectedRequestId?: string;
  selectedRequest?: AccessibleChangeRequest;
  groupServers: AccessServer[] = [];
  crServers: AccessServer[] = [];
  userImplementerGroups: ImplementerGroup[] = [];
  isLoading = false;
  isLoadingServers = false;

  /** Active sessions from Proxy Control Plane (for Sessions tab). */
  allActiveSessions: GatewaySession[] = [];
  isLoadingSessions = false;
  sessionStatusFilter: 'active' | 'all' = 'active';

  /** Sessions persist per VM while switching between views in this page. */
  private sessionsByVmId = new Map<string, ActiveSession[]>();

  get currentUser(): string {
    const user = this.auth.user();
    return user?.username || 'unknown';
  }

  get activeServers(): AccessServer[] {
    return this.activeSection === 'Servers'
      ? this.filteredGroupServers
      : this.crServers;
  }

  ngOnInit(): void {
    this.loadAccessibleAssets();
    this.loadAccessibleRequests();
  }

  selectSection(section: string): void {
    this.activeSection = section;
    if (
      section === 'Change Requests' &&
      !this.selectedRequest &&
      this.accessibleRequests.length
    ) {
      this.onCrSelected(this.accessibleRequests[0].id);
    } else if (section === 'Change Requests') {
      this.loadAllSessions();
    }
    if (section === 'Sessions') {
      this.loadAllSessions();
    }
  }

  loadAllSessions(): void {
    this.isLoadingSessions = true;
    this.sessionsApi.list({ status: 'ACTIVE' }).subscribe({
      next: ({ sessions }) => {
        this.allActiveSessions = sessions;
        this.isLoadingSessions = false;
        // Refresh per-server session lists too
        this.syncServerSessions(sessions);
        this.cd.detectChanges();
      },
      error: () => {
        this.isLoadingSessions = false;
        this.cd.detectChanges();
      },
    });
  }

  private syncServerSessions(backendSessions: GatewaySession[]): void {
    // Update groupServers sessions lists
    for (const server of this.groupServers) {
      const active: ActiveSession[] = this.sessionsForServer(backendSessions, server).map((s) =>
        this.gatewayToActiveSession(s, server),
      );
      server.sessions = active;
      this.sessionsByVmId.set(server.vmId, active);
    }
    for (const server of this.crServers) {
      const active: ActiveSession[] = this.sessionsForServer(
        backendSessions,
        server,
        this.selectedRequest?.id,
      ).map((s) =>
        this.gatewayToActiveSession(s, server),
      );
      server.sessions = active;
      this.sessionsByVmId.set(server.vmId, active);
    }
  }

  private sessionsForServer(
    sessions: GatewaySession[],
    server: AccessServer,
    crId?: string,
  ): GatewaySession[] {
    return sessions.filter(
      (session) =>
        session.hostId === server.hostname &&
        (!crId || session.crId === crId) &&
        session.status === 'ACTIVE',
    );
  }

  private gatewayToActiveSession(s: GatewaySession, server?: AccessServer): ActiveSession {
    return {
      crNumber: s.crId ? formatChangeRequestNumber(s.crId) : 'Direct',
      crId: s.crId,
      createdBy: s.userId ?? '',
      lastActivity: s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).toLocaleTimeString() : 'Active',
      osUser: server?.selectedOsUser ?? '',
      currentImplementor: s.userId ?? '',
      primaryAction: s.userId === this.auth.user()?.sub ? 'Rejoin' : 'Observe',
      primaryEnabled: true,
      canStop: this.isMySession(s) || this.can('access.stop'),
      canWatch: true,
      sessionId: s.sessionId,
      gatewayHostId: s.hostId,
    };
  }

  get filteredAllSessions(): GatewaySession[] {
    if (this.sessionStatusFilter === 'active') {
      return this.allActiveSessions.filter((s) => s.status === 'ACTIVE');
    }
    return this.allActiveSessions;
  }

  isMySession(session: GatewaySession): boolean {
    return session.userId === this.auth.user()?.sub;
  }

  sessionStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'green';
      case 'CLOSED': return 'default';
      default: return 'default';
    }
  }

  reconnectGatewaySession(session: GatewaySession): void {
    this.openGatewaySession(session, 'rejoin');
  }

  observeGatewaySession(session: GatewaySession): void {
    this.openGatewaySession(session, 'observe');
  }

  private openGatewaySession(session: GatewaySession, mode: 'rejoin' | 'observe'): void {
    const server = this.findServerByGatewayHostId(session.hostId);
    const params = new URLSearchParams({
      user: server?.selectedOsUser ?? '',
      host: server?.hostname ?? session.hostId,
      ip: server?.ipAddress ?? '',
      cr: session.crId ? formatChangeRequestNumber(session.crId) : 'Direct',
      hostId: session.hostId,
      crId: session.crId,
      sessionId: session.sessionId,
      mode,
    });
    window.open(`/terminal?${params.toString()}`, '_blank', 'popup=yes,width=1200,height=760');
  }

  joinBackendSession(session: GatewaySession): void {
    this.observeGatewaySession(session);
  }

  private findServerByGatewayHostId(hostId: string): AccessServer | undefined {
    return [...this.groupServers, ...this.crServers].find((server) => server.hostname === hostId);
  }

  private loadAccessibleAssets(): void {
    this.isLoadingServers = true;
    this.implementerGroupService.findAccessibleVms().subscribe({
      next: ({ implementerGroups, vms }) => {
        this.userImplementerGroups = implementerGroups;
        this.groupServers = vms.map((vm) =>
          this.mapVmToAccessServer(vm, implementerGroups),
        );
        this.isLoadingServers = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error loading accessible servers:', err);
        this.isLoadingServers = false;
        this.cd.detectChanges();
      },
    });
  }

  private loadAccessibleRequests(): void {
    this.isLoading = true;
    this.changeRequestService.findAccessible().subscribe({
      next: (requests) => {
        this.accessibleRequests = requests;
        this.isLoading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Error loading accessible change requests:', err);
        this.isLoading = false;
        this.cd.detectChanges();
      },
    });
  }

  private mapVmToAccessServer(
    vm: VirtualMachine,
    groups: ImplementerGroup[],
  ): AccessServer {
    if (!this.sessionsByVmId.has(vm.id)) {
      this.sessionsByVmId.set(vm.id, []);
    }
    const relevantGroups = groups.filter((group) =>
      (group.vmIds ?? []).includes(vm.id),
    );
    const osUsers = [
      ...new Set(relevantGroups.flatMap((group) => group.osUsers ?? [])),
    ];
    return {
      vmId: vm.id,
      hostname: vm.hostname,
      ipAddress: vm.ipAddress,
      assetStatus: vm.assetStatus,
      osVersion: vm.osVersion,
      sshPort: vm.sshPort,
      expanded: false,
      osUsers,
      selectedOsUser: osUsers[0] ?? '',
      sessions: this.sessionsByVmId.get(vm.id)!,
      implementerGroups: relevantGroups.map((group) => group.name),
    };
  }

  selectRequest(requestId: string): void {
    this.selectedRequestId = requestId;
    this.selectedRequest = this.accessibleRequests.find(
      (request) => request.id === requestId,
    );
    this.crServers = (this.selectedRequest?.vms ?? []).map((vm) => {
      const server = this.mapVmToAccessServer(
        vm,
        this.selectedRequest?.implementerGroups ?? [],
      );
      const osUsers = this.selectedRequest?.osUsers?.length
        ? [...this.selectedRequest.osUsers]
        : server.osUsers;
      return {
        ...server,
        osUsers,
        selectedOsUser: osUsers[0] ?? '',
      };
    });
    this.syncServerSessions(this.allActiveSessions);
    if (this.activeSection === 'Change Requests') {
      this.loadAllSessions();
    }
  }

  crNumber(request: AccessibleChangeRequest): string {
    return formatChangeRequestNumber(request.id);
  }

  /** CRs matching the search field text, by CR number, title or requester. */
  get matchingRequests(): AccessibleChangeRequest[] {
    const term = this.crSearchTerm.trim().toLowerCase();
    if (!term) {
      return this.accessibleRequests;
    }
    return this.accessibleRequests.filter(
      (request) =>
        this.crNumber(request).toLowerCase().includes(term) ||
        request.id.toLowerCase().includes(term) ||
        request.title.toLowerCase().includes(term) ||
        request.requester.toLowerCase().includes(term),
    );
  }

  get filteredGroupServers(): AccessServer[] {
    const term = this.serverSearchTerm.trim().toLowerCase();
    if (!term) {
      return this.groupServers;
    }
    return this.groupServers.filter(
      (server) =>
        server.hostname.toLowerCase().includes(term) ||
        server.ipAddress.toLowerCase().includes(term) ||
        server.osVersion.toLowerCase().includes(term) ||
        server.implementerGroups.some((group) =>
          group.toLowerCase().includes(term),
        ),
    );
  }

  onCrSelected(requestId: string): void {
    this.selectRequest(requestId);
    const selected = this.accessibleRequests.find((r) => r.id === requestId);
    this.crSearchTerm = selected ? this.crNumber(selected) : '';
  }

  sortHostname = (a: AccessServer, b: AccessServer) =>
    a.hostname.localeCompare(b.hostname);
  sortIp = (a: AccessServer, b: AccessServer) =>
    a.ipAddress.localeCompare(b.ipAddress);
  sortStatus = (a: AccessServer, b: AccessServer) =>
    a.assetStatus.localeCompare(b.assetStatus);
  sortOs = (a: AccessServer, b: AccessServer) =>
    a.osVersion.localeCompare(b.osVersion);
  sortSessions = (a: AccessServer, b: AccessServer) =>
    a.sessions.length - b.sessions.length;

  launchNew(server: AccessServer): void {
    const crLabel =
      this.activeSection === 'Change Requests' && this.selectedRequest
        ? this.crNumber(this.selectedRequest)
        : 'Direct';
    const crId =
      this.activeSection === 'Change Requests' && this.selectedRequest
        ? this.selectedRequest.id
        : '';
    this.openTerminalWindow(server, server.selectedOsUser, crLabel, crId);
    // Refresh sessions list after a short delay to pick up the new session
    setTimeout(() => this.loadAllSessions(), 2000);
  }

  joinSession(server: AccessServer, session: ActiveSession): void {
    session.currentImplementor = this.currentUser;
    session.primaryEnabled = false;
    session.lastActivity = 'Active';
    this.openTerminalWindow(
      server,
      session.osUser,
      session.crNumber,
      session.crId ?? '',
      session.sessionId,
      session.primaryAction === 'Observe' ? 'observe' : 'rejoin',
    );
  }

  watchSession(server: AccessServer, session: ActiveSession): void {
    this.openTerminalWindow(
      server,
      session.osUser,
      session.crNumber,
      session.crId ?? '',
      session.sessionId,
      'observe',
    );
  }

  canUseSessionAction(session: ActiveSession): boolean {
    return session.primaryAction === 'Observe' || this.can('access.launch');
  }

  private openTerminalWindow(
    server: AccessServer,
    osUser: string,
    crLabel: string,
    crId: string,
    sessionId?: string,
    mode?: 'rejoin' | 'observe',
  ): void {
    const p: Record<string, string> = {
      user: osUser,
      host: server.hostname,
      ip: server.ipAddress,
      cr: crLabel,
      hostId: server.hostname,
      crId,
    };
    if (sessionId) p['sessionId'] = sessionId;
    if (mode) p['mode'] = mode;
    window.open(
      `/terminal?${new URLSearchParams(p).toString()}`,
      '_blank',
      'popup=yes,width=1200,height=760',
    );
  }

  requestSession(session: ActiveSession): void {
    session.primaryEnabled = false;
  }

  stopSession(server: AccessServer, session: ActiveSession): void {
    if (!session.sessionId) {
      this.removeLocalSession(server, session);
      return;
    }

    this.sessionsApi.close(session.sessionId).subscribe({
      next: () => {
        this.removeLocalSession(server, session);
        this.allActiveSessions = this.allActiveSessions.filter(
          (s) => s.sessionId !== session.sessionId,
        );
        this.cd.detectChanges();
      },
      error: () => {
        this.loadAllSessions();
        this.cd.detectChanges();
      },
    });
  }

  private removeLocalSession(server: AccessServer, session: ActiveSession): void {
    const sessions = server.sessions.filter((s) => s !== session);
    server.sessions = sessions;
    this.sessionsByVmId.set(server.vmId, sessions);
  }

  can(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Active':
        return 'green';
      case 'Maintenance':
        return 'orange';
      case 'Retired':
        return 'red';
      default:
        return 'default';
    }
  }
}
