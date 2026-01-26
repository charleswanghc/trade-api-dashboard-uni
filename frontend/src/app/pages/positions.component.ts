import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-positions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <h2>未平倉部位</h2>
      <p style="color: var(--muted);">目前後端尚未提供部位查詢端點。</p>
    </div>
  `
})
export class PositionsComponent {}
