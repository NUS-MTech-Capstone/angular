import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChangeRequestService } from '../../services/change-request.service';
import { ImplementerGroupService } from '../../services/implementer-group.service';
import { AuthService } from '../../services/auth.service';
import { Access } from './access';

describe('Access', () => {
  let component: Access;
  let fixture: ComponentFixture<Access>;
  let changeRequestService: { findAccessible: ReturnType<typeof vi.fn> };
  let implementerGroupService: { findAccessibleVms: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    changeRequestService = {
      findAccessible: vi.fn(() => of([])),
    };
    implementerGroupService = {
      findAccessibleVms: vi.fn(() =>
        of({ implementerGroups: [], osUsers: [], vms: [] }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [Access],
      providers: [
        { provide: ChangeRequestService, useValue: changeRequestService },
        { provide: ImplementerGroupService, useValue: implementerGroupService },
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
});
