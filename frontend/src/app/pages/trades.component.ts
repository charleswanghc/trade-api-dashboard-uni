import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h2>成交與委託紀錄</h2>
      <p style="color: var(--muted);">目前後端尚未提供成交查詢端點。</p>
    </div>
  `
})
export class TradesComponent {}
