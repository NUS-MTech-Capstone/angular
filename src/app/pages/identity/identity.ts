import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import {
  IdentityService,
  ManagedUser,
  PolicyRow,
} from '../../services/identity.service';
import {
  ImplementerGroup,
  ImplementerGroupMembershipRequest,
  ImplementerGroupMember,
  ImplementerGroupService,
} from '../../services/implementer-group.service';
import {
  InventoryService,
  VirtualMachine,
} from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-identity',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzPopconfirmModule,
    NzBadgeModule,
  ],
  templateUrl: './identity.html',
  styleUrls: ['./identity.css'],
})
export class Identity implements OnInit {
  users: ManagedUser[] = [];
  roles: string[] = [];
  permissions: string[] = [];
  policies: PolicyRow[] = [];

  isLoadingUsers = false;
  isLoadingPolicies = false;
  isSavingPolicies = false;
  isCreateModalOpen = false;
  isSubmittingUser = false;
  policiesDirty = false;

  // Audit search/filter
  userSearchTerm = '';
  selectedRoleFilter = '';

  implementerGroups: ImplementerGroup[] = [];
  inventoryVms: VirtualMachine[] = [];
  isLoadingGroups = false;
  isGroupModalOpen = false;
  isSubmittingGroup = false;
  editingGroupId?: string;
  groupForm!: FormGroup;

  membershipRequests: ImplementerGroupMembershipRequest[] = [];
  groupMembers: ImplementerGroupMember[] = [];
  membershipTab: 'All' | 'Pending' | 'Approved' | 'Rejected' = 'Pending';
  membershipTabOptions: Array<'Pending' | 'Approved' | 'Rejected' | 'All'> = [
    'Pending',
    'Approved',
    'Rejected',
    'All',
  ];
  isLoadingMembership = false;
  isMembershipModalOpen = false;
  isSubmittingMembership = false;
  selectedMembersGroupId?: string;
  membershipForm!: FormGroup;

  rolesModalUser?: ManagedUser;
  rolesDraft: string[] = [];
  isSavingRoles = false;

  createForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    private identityService: IdentityService,
    private implementerGroupService: ImplementerGroupService,
    private inventoryService: InventoryService,
    private auth: AuthService,
    private message: NzMessageService,
  ) {
    this.createForm = this.fb.group({
      username: [null as string | null, [Validators.required]],
      email: [null as string | null, [Validators.required, Validators.email]],
      name: [null as string | null],
      roles: [['Employee'] as string[], [Validators.required]],
    });
    this.groupForm = this.fb.group({
      name: [null as string | null, [Validators.required]],
      description: [null as string | null],
      osUsers: [[] as string[]],
      vmIds: [[] as string[]],
    });
    this.membershipForm = this.fb.group({
      username: [null as string | null, [Validators.required]],
      implementerGroupId: [null as string | null, [Validators.required]],
      comments: [null as string | null],
    });
  }

  can(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  get currentUserName(): string {
    const user = this.auth.user();
    return user?.name || user?.username || 'admin';
  }

  get filteredMembershipRequests(): ImplementerGroupMembershipRequest[] {
    if (this.membershipTab === 'All') {
      return this.membershipRequests;
    }
    return this.membershipRequests.filter(
      (request) => request.status === this.membershipTab,
    );
  }

  /** Users matching the search term and role filter. */
  get filteredUsers(): ManagedUser[] {
    const term = this.userSearchTerm.trim().toLowerCase();
    return this.users.filter((user) => {
      const matchesSearch =
        !term ||
        user.username.toLowerCase().includes(term) ||
        (user.name ?? '').toLowerCase().includes(term) ||
        (user.email ?? '').toLowerCase().includes(term);
      const matchesRole =
        !this.selectedRoleFilter ||
        user.roles.includes(this.selectedRoleFilter);
      return matchesSearch && matchesRole;
    });
  }

  onMembershipTabChange(index: number): void {
    this.membershipTab = this.membershipTabOptions[index];
  }

  ngOnInit(): void {
    this.loadCatalog();
    this.loadUsers();
    if (this.can('identity.policies.manage')) {
      this.loadPolicies();
    }
    if (this.can('identity.users.manage')) {
      this.loadImplementerGroups();
      this.loadMembershipRequests();
      this.loadInventoryVms();
    }
  }

  private loadInventoryVms(): void {
    this.inventoryService.findAll().subscribe({
      next: (vms) => {
        this.inventoryVms = vms;
        this.cd.detectChanges();
      },
      error: () => this.message.error('Failed to load inventory VMs'),
    });
  }

  private loadCatalog(): void {
    this.identityService.getRoleCatalog().subscribe({
      next: (catalog) => {
        this.roles = [...catalog.roles];
        this.permissions = [...catalog.permissions];
        this.cd.detectChanges();
      },
      error: () => this.message.error('Failed to load role catalog'),
    });
  }

  private loadUsers(): void {
    this.isLoadingUsers = true;
    this.identityService.listUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.isLoadingUsers = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.message.error('Failed to load users');
        this.isLoadingUsers = false;
        this.cd.detectChanges();
      },
    });
  }

  private loadPolicies(): void {
    this.isLoadingPolicies = true;
    this.identityService.getPolicies().subscribe({
      next: (policies) => {
        this.policies = policies;
        this.policiesDirty = false;
        this.isLoadingPolicies = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.message.error('Failed to load policies');
        this.isLoadingPolicies = false;
        this.cd.detectChanges();
      },
    });
  }

  // --- Users ---

  openCreateModal(): void {
    this.createForm.reset({ username: null, email: null, name: null, roles: ['Employee'] });
    this.isCreateModalOpen = true;
  }

  submitCreateUser(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.isSubmittingUser = true;
    this.identityService.createUser(this.createForm.value).subscribe({
      next: () => {
        this.isSubmittingUser = false;
        this.isCreateModalOpen = false;
        this.message.success('User created successfully');
        this.loadUsers();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Failed to create user');
        this.isSubmittingUser = false;
        this.cd.detectChanges();
      },
    });
  }

  toggleUserEnabled(user: ManagedUser, enabled: boolean): void {
    this.identityService.setUserStatus(user.username, enabled).subscribe({
      next: (updated) => {
        user.enabled = updated.enabled;
        this.message.success(`User ${user.username} ${enabled ? 'enabled' : 'disabled'}`);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Failed to update user status');
        this.loadUsers();
      },
    });
  }

  openRolesModal(user: ManagedUser): void {
    this.rolesModalUser = user;
    this.rolesDraft = [...user.roles];
  }

  saveRoles(): void {
    if (!this.rolesModalUser) {
      return;
    }
    this.isSavingRoles = true;
    this.identityService
      .setUserRoles(this.rolesModalUser.username, this.rolesDraft)
      .subscribe({
        next: (updated) => {
          this.rolesModalUser!.roles = updated.roles;
          this.isSavingRoles = false;
          this.message.success('Roles updated');
          this.rolesModalUser = undefined;
          this.cd.detectChanges();
        },
        error: (err) => {
          this.message.error(err?.error?.message ?? 'Failed to update roles');
          this.isSavingRoles = false;
          this.cd.detectChanges();
        },
      });
  }

  // --- Policies ---

  hasPolicyPermission(role: string, permission: string): boolean {
    const row = this.policies.find((policy) => policy.role === role);
    return row?.permissions.includes(permission) ?? false;
  }

  togglePolicyPermission(role: string, permission: string, granted: boolean): void {
    const row = this.policies.find((policy) => policy.role === role);
    if (!row) {
      return;
    }
    if (granted && !row.permissions.includes(permission)) {
      row.permissions = [...row.permissions, permission];
    }
    if (!granted) {
      row.permissions = row.permissions.filter((p) => p !== permission);
    }
    this.policiesDirty = true;
  }

  savePolicies(): void {
    this.isSavingPolicies = true;
    this.identityService.updatePolicies(this.policies).subscribe({
      next: (policies) => {
        this.policies = policies;
        this.policiesDirty = false;
        this.isSavingPolicies = false;
        this.message.success('Policies saved');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Failed to save policies');
        this.isSavingPolicies = false;
        this.cd.detectChanges();
      },
    });
  }

  // --- Implementer groups ---

  private loadImplementerGroups(): void {
    this.isLoadingGroups = true;
    this.implementerGroupService.findAll().subscribe({
      next: (groups) => {
        this.implementerGroups = groups;
        this.isLoadingGroups = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.message.error('Failed to load implementer groups');
        this.isLoadingGroups = false;
        this.cd.detectChanges();
      },
    });
  }

  openCreateGroupModal(): void {
    this.editingGroupId = undefined;
    this.groupForm.reset({ name: null, description: null, osUsers: [], vmIds: [] });
    this.isGroupModalOpen = true;
  }

  openEditGroupModal(group: ImplementerGroup): void {
    this.editingGroupId = group.id;
    this.groupForm.setValue({
      name: group.name,
      description: group.description || '',
      osUsers: group.osUsers || [],
      vmIds: group.vmIds || [],
    });
    this.isGroupModalOpen = true;
  }

  vmLabel(vmId: string): string {
    const vm = this.inventoryVms.find((item) => item.id === vmId);
    return vm ? `${vm.hostname} (${vm.ipAddress})` : vmId;
  }

  submitGroupForm(): void {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      return;
    }
    this.isSubmittingGroup = true;
    const value = this.groupForm.value;
    const request$ = this.editingGroupId
      ? this.implementerGroupService.update(this.editingGroupId, value)
      : this.implementerGroupService.create(value);

    request$.subscribe({
      next: () => {
        this.isSubmittingGroup = false;
        this.isGroupModalOpen = false;
        this.message.success(this.editingGroupId ? 'Group updated' : 'Group created');
        this.loadImplementerGroups();
      },
      error: (err) => {
        this.message.error(err?.error?.message ?? 'Failed to save group');
        this.isSubmittingGroup = false;
        this.cd.detectChanges();
      },
    });
  }

  deleteGroup(group: ImplementerGroup): void {
    this.implementerGroupService.remove(group.id).subscribe({
      next: () => {
        this.message.success('Group deleted');
        this.loadImplementerGroups();
      },
      error: (err) => this.message.error(err?.error?.message ?? 'Failed to delete group'),
    });
  }

  // --- Group membership approval ---

  groupName(groupId: string): string {
    return this.implementerGroups.find((group) => group.id === groupId)?.name ?? groupId;
  }

  private loadMembershipRequests(): void {
    this.isLoadingMembership = true;
    this.implementerGroupService.findMembershipRequests().subscribe({
      next: (requests) => {
        this.membershipRequests = requests;
        this.isLoadingMembership = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.message.error('Failed to load membership requests');
        this.isLoadingMembership = false;
        this.cd.detectChanges();
      },
    });
  }

  openMembershipModal(): void {
    this.membershipForm.reset({
      username: null,
      implementerGroupId: null,
      comments: null,
    });
    this.isMembershipModalOpen = true;
  }

  submitMembershipRequest(): void {
    if (this.membershipForm.invalid) {
      this.membershipForm.markAllAsTouched();
      return;
    }
    this.isSubmittingMembership = true;
    const value = this.membershipForm.value;
    this.implementerGroupService
      .createMembershipRequest({
        username: value.username,
        implementerGroupId: value.implementerGroupId,
        requester: this.currentUserName,
        comments: value.comments || undefined,
      })
      .subscribe({
        next: () => {
          this.isSubmittingMembership = false;
          this.isMembershipModalOpen = false;
          this.message.success('Membership request submitted');
          this.loadMembershipRequests();
        },
        error: (err) => {
          this.message.error(err?.error?.message ?? 'Failed to submit request');
          this.isSubmittingMembership = false;
          this.cd.detectChanges();
        },
      });
  }

  approveMembership(request: ImplementerGroupMembershipRequest): void {
    this.implementerGroupService.approveMembershipRequest(request.id).subscribe({
      next: () => {
        this.message.success('Membership approved');
        this.loadMembershipRequests();
        if (this.selectedMembersGroupId === request.implementerGroupId) {
          this.loadGroupMembers(request.implementerGroupId);
        }
      },
      error: (err) => this.message.error(err?.error?.message ?? 'Failed to approve'),
    });
  }

  rejectMembership(request: ImplementerGroupMembershipRequest): void {
    this.implementerGroupService.rejectMembershipRequest(request.id).subscribe({
      next: () => {
        this.message.success('Membership rejected');
        this.loadMembershipRequests();
      },
      error: (err) => this.message.error(err?.error?.message ?? 'Failed to reject'),
    });
  }

  loadGroupMembers(groupId: string): void {
    this.selectedMembersGroupId = groupId;
    this.implementerGroupService.findMembers(groupId).subscribe({
      next: (members) => {
        this.groupMembers = members;
        this.cd.detectChanges();
      },
      error: (err) => this.message.error(err?.error?.message ?? 'Failed to load members'),
    });
  }

  removeGroupMember(member: ImplementerGroupMember): void {
    this.implementerGroupService
      .removeMember(member.implementerGroupId, member.username)
      .subscribe({
        next: () => {
          this.message.success('Member removed');
          if (this.selectedMembersGroupId) {
            this.loadGroupMembers(this.selectedMembersGroupId);
          }
        },
        error: (err) => this.message.error(err?.error?.message ?? 'Failed to remove member'),
      });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Approved':
        return 'green';
      case 'Rejected':
        return 'red';
      default:
        return 'orange';
    }
  }

  getRoleColor(role: string): string {
    const map: Record<string, string> = {
      Admin: 'red',
      Manager: 'blue',
      TechnicalStaff: 'cyan',
      SecurityAnalyst: 'orange',
      Auditor: 'gold',
      Employee: 'default',
    };
    return map[role] ?? 'purple';
  }
}
