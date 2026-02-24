import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-2">
      <div class="card">
        <h2>系統狀態</h2>
        <div *ngIf="health; else loading">
          <p>狀態：<span class="badge" [ngClass]="health.status === 'ok' ? 'success' : 'error'">{{ health.status }}</span></p>
          <p>Unitrade：{{ health.unitrade }}</p>
        </div>
        <ng-template #loading>載入中...</ng-template>
      </div>
      <div class="card">
        <h2>快速連結</h2>
        <ul>
          <li>Webhook：/webhook</li>
          <li>手動下單：/order</li>
          <li>健康檢查：/health</li>
        </ul>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  health: any;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.health().subscribe((data) => (this.health = data));
  }
}
