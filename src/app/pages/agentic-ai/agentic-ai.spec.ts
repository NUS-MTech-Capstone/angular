import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { icons } from '../../icons-provider';
import { IncidentAgentService } from '../../services/incident-agent.service';
import { AgenticAi } from './agentic-ai';
import { incidentFixture } from './agentic-ai.test-fixtures';

describe('AgenticAi incident list', () => {
  let component: AgenticAi;
  let fixture: ComponentFixture<AgenticAi>;
  let legacyIncidentId: string | null;
  let incidentAgent: { list: ReturnType<typeof vi.fn> };
  let message: { error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    legacyIncidentId = null;
    incidentAgent = { list: vi.fn(() => of({ incidents: [incidentFixture()] })) };
    message = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AgenticAi],
      providers: [
        provideNzIcons(icons),
        provideRouter([]),
        { provide: IncidentAgentService, useValue: incidentAgent },
        { provide: NzMessageService, useValue: message },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => legacyIncidentId } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgenticAi);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('uses incidents as the default list and renders deep links instead of a drawer', () => {
    expect(component.incidents).toHaveLength(1);
    expect(component.awaitingApprovalCount).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Awaiting approval');

    const link = fixture.nativeElement.querySelector('a[href="/agentic-ai/incidents/inc-1"]');
    expect(link).not.toBeNull();
    expect((component as unknown as Record<string, unknown>)['isDrawerOpen']).toBeUndefined();
  });

  it('filters incidents using readable states', () => {
    component.incidents = [incidentFixture(), incidentFixture('FAILED')];
    component.stateFilter = 'FAILED';

    expect(component.filteredIncidents).toHaveLength(1);
    expect(component.filteredIncidents[0].state).toBe('FAILED');
    expect(component.stateLabel('AWAITING_APPROVAL')).toBe('Awaiting approval');
  });

  it('treats a null incident list as empty', () => {
    incidentAgent.list.mockReturnValueOnce(of({ incidents: null } as never));

    component.loadIncidents();

    expect(component.incidents).toEqual([]);
  });

  it('redirects legacy incident query links to the dedicated incident route', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    legacyIncidentId = 'inc-legacy';

    component.ngOnInit();

    expect(navigate).toHaveBeenCalledWith(
      ['/agentic-ai/incidents', 'inc-legacy'],
      { replaceUrl: true },
    );
  });
});
