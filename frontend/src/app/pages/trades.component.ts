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

  /**
   * pfctrade match_time 格式：HHMMSSZZZ (9 位數字字串，台灣當地時間)
   * 例："104508120" → "10:45:08"
   * 日期從 created_at (UTC) 轉換為台灣時間 (UTC+8) 取得
   * 最終格式："yyyy/MM/dd HH:mm:ss" (台灣時區)
   */
  formatMatchTime(trade: TradeRecord): string {
    const raw = trade.match_time;
    const mdate = trade.mdate;

    // 解析時間部分
    let timeStr = '';
    if (raw && /^\d{9}$/.test(raw)) {
      const h = raw.slice(0, 2);
      const m = raw.slice(2, 4);
      const s = raw.slice(4, 6);
      timeStr = `${h}:${m}:${s}`;
    } else if (raw) {
      timeStr = raw;
    }

    // mdate 有值則優先用 (YYYYMMDD)
    if (mdate && /^\d{8}$/.test(mdate)) {
      const y  = mdate.slice(0, 4);
      const mo = mdate.slice(4, 6);
      const d  = mdate.slice(6, 8);
      return timeStr ? `${y}/${mo}/${d} ${timeStr}` : `${y}/${mo}/${d}`;
    }

    // 從 created_at 取台灣日期 (UTC+8)
    if (trade.created_at && timeStr) {
      const twDate = new Date(
        new Date(trade.created_at + 'Z').getTime() + 8 * 60 * 60 * 1000
      );
      const y  = twDate.getUTCFullYear();
      const mo = String(twDate.getUTCMonth() + 1).padStart(2, '0');
      const d  = String(twDate.getUTCDate()).padStart(2, '0');
      return `${y}/${mo}/${d} ${timeStr}`;
    }

    return timeStr || '–';
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
