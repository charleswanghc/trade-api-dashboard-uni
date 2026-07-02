import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, SignalHistory } from '../services/api.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss',
})
export class AlertsComponent implements OnInit {
  signals: SignalHistory[] = [];
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadSignals();
  }

  loadSignals(): void {
    this.loading = true;
    this.api.getSignals(100).subscribe({
      next: d => { this.signals = d; this.loading = false; },
      error: () => { this.signals = []; this.loading = false; },
    });
  }

  getSignalClass(type: string): string {
    if (type?.includes('entry')) return 'success';
    if (type?.includes('exit')) return 'warning';
    return 'info';
  }

  getStatusClass(status: string): string {
    if (status === 'processed' || status === 'ok') return 'success';
    if (status === 'failed' || status === 'error') return 'error';
    if (status === 'ignored') return 'warning';
    return 'info';
  }

  getStatusLabel(signal: SignalHistory): string {
    if (signal.status === 'processed' || signal.status === 'ok') return '已轉單';
    if (signal.status === 'failed' || signal.status === 'error') return '轉單失敗';
    if (signal.status === 'ignored') return '已忽略';
    if (signal.status === 'processing') return '處理中';
    return signal.status;
  }

  getStatusDetail(signal: SignalHistory): string {
    if (signal.error_message) return signal.error_message;
    if (signal.order_id) return `委託已送出，單號 ${signal.order_id}`;
    if (signal.status === 'processed' || signal.status === 'ok') return '訊號已轉成委託，請到訂單頁確認是否成交';
    if (signal.status === 'ignored') return '策略停用或條件不符，未送出委託';
    return '—';
  }
}
