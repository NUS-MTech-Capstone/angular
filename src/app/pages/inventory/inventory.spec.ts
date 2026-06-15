import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { icons } from '../../icons-provider';
import { InventoryService } from '../../services/inventory.service';
import { AuthService } from '../../services/auth.service';
import { Inventory } from './inventory';

describe('Inventory', () => {
  let component: Inventory;
  let fixture: ComponentFixture<Inventory>;
  let inventoryService: {
    findAll: ReturnType<typeof vi.fn>;
    findAllChangeRequests: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    inventoryService = {
      findAll: vi.fn(() => of([])),
      findAllChangeRequests: vi.fn(() => of([])),
    };

    await TestBed.configureTestingModule({
      imports: [Inventory],
      providers: [
        provideNzIcons(icons),
        { provide: InventoryService, useValue: inventoryService },
        {
          provide: AuthService,
          useValue: {
            user: vi.fn(() => ({ username: 'testuser' })),
            hasPermission: vi.fn(() => true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Inventory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load inventory data on init', () => {
    expect(inventoryService.findAll).toHaveBeenCalled();
    expect(inventoryService.findAllChangeRequests).toHaveBeenCalled();
  });
});
