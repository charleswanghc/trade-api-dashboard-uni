import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, TradeRecord } from '../services/api.service';

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trades.component.html',
  styleUrl: './trades.component.scss',
})
export class TradesComponent implements OnInit {
  trades: TradeRecord[] = [];
  orderReplies: any[] = [];
  loading = false;
  syncing = false;
  syncMessage = '';
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.api.getTrades(100).subscribe({
      next: (data) => {
        this.trades = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.detail || err?.message || '載入失敗';
        this.loading = false;
      },
    });

    this.api.getOrderReplies(100).subscribe({
      next: (data) => (this.orderReplies = data),
      error: () => {},
    });
  }

  bsLabel(bs: string | undefined): string {
    if (bs === 'B') return '買進';
    if (bs === 'S') return '賣出';
    return bs ?? '–';
  }

  bsClass(bs: string | undefined): string {
    if (bs === 'B') return 'badge-buy';
    if (bs === 'S') return 'badge-sell';
    return '';
  }

  isRejected(status: string | undefined): boolean {
    if (!status) return false;
    // 狀態碼 9xxx 通常代表交易所拒絕
    return /TTO|拒絕|保證金|不足|錯誤|失敗/.test(status);
  }

  syncHistory(): void {
    this.syncing = true;
    this.syncMessage = '';
    this.api.triggerHistorySync().subscribe({
      next: (res) => {
        this.syncMessage = res.message;
        this.syncing = false;
        this.load(); // 後重新載入資料
      },
      error: (err) => {
        this.syncMessage = err?.error?.detail || '同步失敗';
        this.syncing = false;
      },
    });
  }
}
