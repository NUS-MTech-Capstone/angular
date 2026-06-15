import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChangeManagement } from './change-management';

describe('ChangeManagement', () => {
  let component: ChangeManagement;
  let fixture: ComponentFixture<ChangeManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangeManagement],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangeManagement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
