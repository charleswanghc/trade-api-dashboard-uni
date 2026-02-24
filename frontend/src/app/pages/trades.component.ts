import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card">
      <div class="card-header">
        <div class="card-title">成交紀錄</div>
      </div>
      <div class="empty-state" style="padding: 52px 20px">
        <div style="font-size: 52px; margin-bottom: 14px; opacity: 0.15">↺</div>
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px">後端尚未提供成交查詢端點</div>
        <div style="font-size: 12px">當成交記錄 API 開放後，此頁面將顯示歷史成交與委託明細</div>
      </div>
    </div>
  `
})
export class TradesComponent {}
