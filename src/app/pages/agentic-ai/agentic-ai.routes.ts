import { Routes } from '@angular/router';
import { AgenticAi } from './agentic-ai';
import { AgenticAiAlerts } from './agentic-ai-alerts';

export const AGENTIC_AI_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'alerts' },
  { path: 'alerts', component: AgenticAiAlerts },
  { path: 'incidents', component: AgenticAi },
];
