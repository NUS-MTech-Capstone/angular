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
import { AuthService } from '../../services/auth.service';
import {
  AccessibleChangeRequest,
  ChangeRequestService,
} from '../../services/change-request.service';
import {
  ImplementerGroup,
  ImplementerGroupService,
} from '../../services/implementer-group.service';
import type { VirtualMachine } from '../../services/inventory.service';

interface ActiveSession {
  crNumber: string;
  createdBy: string;
  lastActivity: string;
  osUser: string;
  currentImplementor: string;
  primaryAction: 'Join' | 'Request';
  primaryEnabled: boolean;
  canStop: boolean;
  canWatch: boolean;
  observer: string | null;
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
  private cd = inject(ChangeDetectorRef);

  sections = ['Servers', 'Change Requests', 'Sessions', 'Proxies'];
  activeSection = 'Servers';
  isPanelCollapsed = false;
  crSearchTerm = '';
  serverSearchTerm = '';
  observerOptions = ['john', 'bob', 'arabasta', 'keiyam'];

  accessibleRequests: AccessibleChangeRequest[] = [];
  selectedRequestId?: string;
  selectedRequest?: AccessibleChangeRequest;
  groupServers: AccessServer[] = [];
  crServers: AccessServer[] = [];
  userImplementerGroups: ImplementerGroup[] = [];
  isLoading = false;
  isLoadingServers = false;

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
    }
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
  }

  crNumber(request: AccessibleChangeRequest): string {
    return `CR-${request.id.slice(0, 8).toUpperCase()}`;
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
    const sessions = [
      {
        crNumber: crLabel,
        createdBy: this.currentUser,
        lastActivity: 'Just now',
        osUser: server.selectedOsUser,
        currentImplementor: this.currentUser,
        primaryAction: 'Join' as const,
        primaryEnabled: false,
        canStop: true,
        canWatch: true,
        observer: null,
      },
      ...server.sessions,
    ];
    server.sessions = sessions;
    this.sessionsByVmId.set(server.vmId, sessions);
    this.openTerminalWindow(server, server.selectedOsUser, crLabel);
  }

  joinSession(server: AccessServer, session: ActiveSession): void {
    session.currentImplementor = this.currentUser;
    session.primaryEnabled = false;
    session.lastActivity = 'Active';
    this.openTerminalWindow(server, session.osUser, session.crNumber);
  }

  private openTerminalWindow(
    server: AccessServer,
    osUser: string,
    crLabel: string,
  ): void {
    const params = new URLSearchParams({
      user: osUser,
      host: server.hostname,
      ip: server.ipAddress,
      cr: crLabel,
      hostId: server.vmId,
      crId: crLabel,
    });
    window.open(
      `/terminal?${params.toString()}`,
      '_blank',
      'popup=yes,width=1200,height=760',
    );
  }

  requestSession(session: ActiveSession): void {
    session.primaryEnabled = false;
  }

  stopSession(server: AccessServer, session: ActiveSession): void {
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
