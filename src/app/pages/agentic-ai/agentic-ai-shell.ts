import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-agentic-ai-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NzIconModule],
  templateUrl: './agentic-ai-shell.html',
  styleUrl: './agentic-ai-shell.css',
})
export class AgenticAiShell {}
