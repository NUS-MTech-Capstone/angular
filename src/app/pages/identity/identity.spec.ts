import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import {
  IdentityService,
  ManagedUser,
  PolicyRow,
} from '../../services/identity.service';
import {
  ImplementerGroup,
  ImplementerGroupMember,
  ImplementerGroupMembershipRequest,
  ImplementerGroupService,
} from '../../services/implementer-group.service';
import { InventoryService, VirtualMachine } from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';
import { Identity } from './identity';

describe('Identity', () => {
  let component: Identity;
  let fixture: ComponentFixture<Identity>;
  let identityService: {
    getRoleCatalog: ReturnType<typeof vi.fn>;
    listUsers: ReturnType<typeof vi.fn>;
    getPolicies: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
    setUserStatus: ReturnType<typeof vi.fn>;
    setUserRoles: ReturnType<typeof vi.fn>;
    updatePolicies: ReturnType<typeof vi.fn>;
  };
  let implementerGroupService: {
    findAll: ReturnType<typeof vi.fn>;
    findMembershipRequests: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    createMembershipRequest: ReturnType<typeof vi.fn>;
    approveMembershipRequest: ReturnType<typeof vi.fn>;
    rejectMembershipRequest: ReturnType<typeof vi.fn>;
    findMembers: ReturnType<typeof vi.fn>;
    removeMember: ReturnType<typeof vi.fn>;
  };
  let inventoryService: { findAll: ReturnType<typeof vi.fn> };
  let authService: {
    user: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
  };
  let message: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const sampleUser = (): ManagedUser => ({
    username: 'alice',
    email: 'alice@example.com',
    name: 'Alice',
    enabled: true,
    status: 'CONFIRMED',
    roles: ['Employee'],
  });

  const sampleGroup = (): ImplementerGroup => ({
    id: 'group-1',
    name: 'Platform Engineering',
    description: 'Ops team',
    osUsers: ['deploy-bot'],
    vmIds: ['vm-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const sampleVm = (): VirtualMachine => ({
    id: 'vm-1',
    hostname: 'web-prod-01',
    ipAddress: '10.0.0.1',
    assetStatus: 'Active',
    osVersion: 'Amazon Linux 2023',
    sshPort: 22,
    tags: ['production'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const sampleMembershipRequest = (): ImplementerGroupMembershipRequest => ({
    id: 'req-1',
    username: 'bob',
    implementerGroupId: 'group-1',
    requester: 'Admin',
    status: 'Pending',
    history: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(async () => {
    identityService = {
      getRoleCatalog: vi.fn(() =>
        of({ roles: ['Employee', 'Admin'], permissions: ['access.view'] }),
      ),
      listUsers: vi.fn(() => of([sampleUser()])),
      getPolicies: vi.fn(() =>
        of([{ role: 'Employee', permissions: ['access.view'] }] as PolicyRow[]),
      ),
      createUser: vi.fn(() => of(sampleUser())),
      setUserStatus: vi.fn((username: string, enabled: boolean) =>
        of({ ...sampleUser(), username, enabled }),
      ),
      setUserRoles: vi.fn((username: string, roles: string[]) =>
        of({ ...sampleUser(), username, roles }),
      ),
      updatePolicies: vi.fn((policies: PolicyRow[]) => of(policies)),
    };
    implementerGroupService = {
      findAll: vi.fn(() => of([sampleGroup()])),
      findMembershipRequests: vi.fn(() => of([sampleMembershipRequest()])),
      create: vi.fn(() => of(sampleGroup())),
      update: vi.fn(() => of(sampleGroup())),
      remove: vi.fn(() => of({ success: true })),
      createMembershipRequest: vi.fn(() => of(sampleMembershipRequest())),
      approveMembershipRequest: vi.fn(() =>
        of({ ...sampleMembershipRequest(), status: 'Approved' }),
      ),
      rejectMembershipRequest: vi.fn(() =>
        of({ ...sampleMembershipRequest(), status: 'Rejected' }),
      ),
      findMembers: vi.fn(() =>
        of([
          {
            id: 'member-1',
            username: 'bob',
            implementerGroupId: 'group-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ] as ImplementerGroupMember[]),
      ),
      removeMember: vi.fn(() => of(undefined)),
    };
    inventoryService = {
      findAll: vi.fn(() => of([sampleVm()])),
    };
    authService = {
      user: vi.fn(() => ({ username: 'admin', name: 'Admin' })),
      hasPermission: vi.fn(() => true),
    };
    message = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Identity],
      providers: [
        provideNzIcons(icons),
        { provide: IdentityService, useValue: identityService },
        { provide: ImplementerGroupService, useValue: implementerGroupService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: AuthService, useValue: authService },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Identity);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads identity data on init when permitted', () => {
    expect(identityService.getRoleCatalog).toHaveBeenCalled();
    expect(identityService.listUsers).toHaveBeenCalled();
    expect(identityService.getPolicies).toHaveBeenCalled();
    expect(implementerGroupService.findAll).toHaveBeenCalled();
    expect(implementerGroupService.findMembershipRequests).toHaveBeenCalled();
    expect(inventoryService.findAll).toHaveBeenCalled();
  });

  it('skips policy and group loads without manage permissions', async () => {
    identityService.getPolicies.mockClear();
    implementerGroupService.findAll.mockClear();
    authService.hasPermission.mockImplementation(
      (permission: string) => permission === 'identity.users.view',
    );

    const restrictedFixture = TestBed.createComponent(Identity);
    await restrictedFixture.whenStable();

    expect(identityService.getPolicies).not.toHaveBeenCalled();
    expect(implementerGroupService.findAll).not.toHaveBeenCalled();
  });

  it('filters users by search term and role', () => {
    component.users = [
      sampleUser(),
      {
        ...sampleUser(),
        username: 'manager.dev',
        name: 'Mona Manager',
        roles: ['Manager'],
      },
    ];

    component.userSearchTerm = 'mona';
    expect(component.filteredUsers).toHaveLength(1);

    component.userSearchTerm = '';
    component.selectedRoleFilter = 'Manager';
    expect(component.filteredUsers).toEqual([
      expect.objectContaining({ username: 'manager.dev' }),
    ]);
  });

  it('filters membership requests by tab', () => {
    component.membershipRequests = [
      sampleMembershipRequest(),
      { ...sampleMembershipRequest(), id: 'req-2', status: 'Approved' },
    ];

    component.membershipTab = 'Pending';
    expect(component.filteredMembershipRequests).toHaveLength(1);

    component.onMembershipTabChange(3);
    expect(component.membershipTab).toBe('All');
    expect(component.filteredMembershipRequests).toHaveLength(2);
  });

  it('maps status and role colors', () => {
    expect(component.getStatusColor('Approved')).toBe('green');
    expect(component.getStatusColor('Rejected')).toBe('red');
    expect(component.getStatusColor('Pending')).toBe('orange');
    expect(component.getRoleColor('Admin')).toBe('red');
    expect(component.getRoleColor('UnknownRole')).toBe('purple');
  });

  it('creates a user when the form is valid', () => {
    component.openCreateModal();
    component.createForm.setValue({
      username: 'new.dev',
      email: 'new@example.com',
      name: 'New Dev',
      roles: ['Employee'],
    });

    component.submitCreateUser();

    expect(identityService.createUser).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith('User created successfully');
    expect(component.isCreateModalOpen).toBe(false);
  });

  it('does not create a user when the form is invalid', () => {
    component.openCreateModal();
    component.submitCreateUser();

    expect(identityService.createUser).not.toHaveBeenCalled();
  });

  it('toggles user enabled state', () => {
    const user = sampleUser();
    component.toggleUserEnabled(user, false);

    expect(identityService.setUserStatus).toHaveBeenCalledWith('alice', false);
    expect(message.success).toHaveBeenCalledWith('User alice disabled');
  });

  it('updates user roles from the roles modal', () => {
    const user = sampleUser();
    component.openRolesModal(user);
    component.rolesDraft = ['Admin'];

    component.saveRoles();

    expect(identityService.setUserRoles).toHaveBeenCalledWith('alice', ['Admin']);
    expect(message.success).toHaveBeenCalledWith('Roles updated');
    expect(component.rolesModalUser).toBeUndefined();
  });

  it('toggles and saves policy permissions', () => {
    component.policies = [{ role: 'Employee', permissions: ['access.view'] }];

    expect(component.hasPolicyPermission('Employee', 'access.view')).toBe(true);
    expect(component.hasPolicyPermission('Employee', 'inventory.view')).toBe(false);

    component.togglePolicyPermission('Employee', 'inventory.view', true);
    expect(component.policiesDirty).toBe(true);

    component.savePolicies();
    expect(identityService.updatePolicies).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith('Policies saved');
  });

  it('creates and edits implementer groups', () => {
    component.openCreateGroupModal();
    expect(component.isGroupModalOpen).toBe(true);

    component.groupForm.setValue({
      name: 'New Group',
      description: 'Desc',
      osUsers: ['ops'],
      vmIds: ['vm-1'],
    });
    component.submitGroupForm();

    expect(implementerGroupService.create).toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith('Group created');

    component.openEditGroupModal(sampleGroup());
    component.submitGroupForm();

    expect(implementerGroupService.update).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ name: 'Platform Engineering' }),
    );
  });

  it('deletes implementer groups and resolves vm labels', () => {
    component.inventoryVms = [sampleVm()];

    expect(component.vmLabel('vm-1')).toBe('web-prod-01 (10.0.0.1)');
    expect(component.vmLabel('missing')).toBe('missing');
    expect(component.groupName('group-1')).toBe('Platform Engineering');

    component.deleteGroup(sampleGroup());
    expect(implementerGroupService.remove).toHaveBeenCalledWith('group-1');
    expect(message.success).toHaveBeenCalledWith('Group deleted');
  });

  it('submits and approves membership requests', () => {
    component.openMembershipModal();
    component.membershipForm.setValue({
      username: 'bob',
      implementerGroupId: 'group-1',
      comments: 'Please add',
    });

    component.submitMembershipRequest();

    expect(implementerGroupService.createMembershipRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'bob',
        implementerGroupId: 'group-1',
        requester: 'Admin',
      }),
    );
    expect(message.success).toHaveBeenCalledWith('Membership request submitted');

    component.approveMembership(sampleMembershipRequest());
    expect(implementerGroupService.approveMembershipRequest).toHaveBeenCalledWith('req-1');
    expect(message.success).toHaveBeenCalledWith('Membership approved');
  });

  it('rejects membership requests and manages group members', () => {
    component.rejectMembership(sampleMembershipRequest());
    expect(implementerGroupService.rejectMembershipRequest).toHaveBeenCalledWith('req-1');

    component.loadGroupMembers('group-1');
    expect(component.selectedMembersGroupId).toBe('group-1');
    expect(component.groupMembers).toHaveLength(1);

    const member = component.groupMembers[0];
    component.removeGroupMember(member);
    expect(implementerGroupService.removeMember).toHaveBeenCalledWith('group-1', 'bob');
    expect(message.success).toHaveBeenCalledWith('Member removed');
  });

  it('shows an error when user creation fails', () => {
    identityService.createUser.mockReturnValue(
      throwError(() => ({ error: { message: 'Duplicate user' } })),
    );
    component.openCreateModal();
    component.createForm.setValue({
      username: 'dup',
      email: 'dup@example.com',
      name: null,
      roles: ['Employee'],
    });

    component.submitCreateUser();

    expect(message.error).toHaveBeenCalledWith('Duplicate user');
    expect(component.isSubmittingUser).toBe(false);
  });
});
