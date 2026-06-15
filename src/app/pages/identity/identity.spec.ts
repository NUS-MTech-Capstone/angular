import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { icons } from '../../icons-provider';
import { IdentityService } from '../../services/identity.service';
import { ImplementerGroupService } from '../../services/implementer-group.service';
import { AuthService } from '../../services/auth.service';
import { Identity } from './identity';

describe('Identity', () => {
  let component: Identity;
  let fixture: ComponentFixture<Identity>;
  let identityService: {
    getRoleCatalog: ReturnType<typeof vi.fn>;
    listUsers: ReturnType<typeof vi.fn>;
    getPolicies: ReturnType<typeof vi.fn>;
  };
  let implementerGroupService: {
    findAll: ReturnType<typeof vi.fn>;
    findMembershipRequests: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    identityService = {
      getRoleCatalog: vi.fn(() => of({ roles: [], permissions: [] })),
      listUsers: vi.fn(() => of([])),
      getPolicies: vi.fn(() => of([])),
    };
    implementerGroupService = {
      findAll: vi.fn(() => of([])),
      findMembershipRequests: vi.fn(() => of([])),
    };

    await TestBed.configureTestingModule({
      imports: [Identity],
      providers: [
        provideNzIcons(icons),
        { provide: IdentityService, useValue: identityService },
        { provide: ImplementerGroupService, useValue: implementerGroupService },
        {
          provide: AuthService,
          useValue: {
            user: vi.fn(() => ({ username: 'admin', name: 'Admin' })),
            hasPermission: vi.fn(() => true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Identity);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load identity data on init', () => {
    expect(identityService.getRoleCatalog).toHaveBeenCalled();
    expect(identityService.listUsers).toHaveBeenCalled();
    expect(identityService.getPolicies).toHaveBeenCalled();
    expect(implementerGroupService.findAll).toHaveBeenCalled();
    expect(implementerGroupService.findMembershipRequests).toHaveBeenCalled();
  });
});
