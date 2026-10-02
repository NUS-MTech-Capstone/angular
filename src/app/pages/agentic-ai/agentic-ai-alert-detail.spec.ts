import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import { IncidentAgentService } from '../../services/incident-agent.service';
import { AgenticAiAlertDetail } from './agentic-ai-alert-detail';
import { alertFixture } from './agentic-ai.test-fixtures';

describe('AgenticAiAlertDetail', () => {
  let component: AgenticAiAlertDetail;
  let fixture: ComponentFixture<AgenticAiAlertDetail>;
  let incidentAgent: { getAlert: ReturnType<typeof vi.fn> };
  let message: { error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    incidentAgent = { getAlert: vi.fn(() => of(alertFixture())) };
    message = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AgenticAiAlertDetail],
      providers: [
        provideNzIcons(icons),
        provideRouter([]),
        { provide: IncidentAgentService, useValue: incidentAgent },
        { provide: NzMessageService, useValue: message },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'alert-1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgenticAiAlertDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows concise alert context with a link to the related incident', () => {
    expect(incidentAgent.getAlert).toHaveBeenCalledWith('alert-1');
    expect(component.alert?.reason).toContain('HTTP 500');
    expect(fixture.nativeElement.textContent).toContain('Alert context');
    expect(fixture.nativeElement.querySelector('a[href="/agentic-ai/incidents/inc-1"]')).not.toBeNull();
  });

  it('reports a missing alert clearly', () => {
    incidentAgent.getAlert.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not found' })),
    );

    component.loadAlert();

    expect(message.error).toHaveBeenCalledWith('Alert not found');
  });
});
