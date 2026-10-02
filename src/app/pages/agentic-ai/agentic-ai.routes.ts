import { Routes } from '@angular/router';
import { AgenticAi } from './agentic-ai';
import { AgenticAiAlerts } from './agentic-ai-alerts';
import { AgenticAiAlertDetail } from './agentic-ai-alert-detail';
import { AgenticAiIncidentDetail } from './agentic-ai-incident-detail';
import { AgenticAiShell } from './agentic-ai-shell';

export const AGENTIC_AI_ROUTES: Routes = [
  {
    path: '',
    component: AgenticAiShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'incidents' },
      { path: 'incidents', component: AgenticAi },
      { path: 'incidents/:incidentId', component: AgenticAiIncidentDetail },
      { path: 'alerts', component: AgenticAiAlerts },
      { path: 'alerts/:alertId', component: AgenticAiAlertDetail },
    ],
  },
];
