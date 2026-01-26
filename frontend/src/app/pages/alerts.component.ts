import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h2>錯誤與通知</h2>
      <p style="color: var(--muted);">此頁面用於顯示系統錯誤與通知，目前尚未串接。</p>
    </div>
  `
})
export class AlertsComponent {}
