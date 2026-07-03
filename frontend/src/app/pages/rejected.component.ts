import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, timer } from 'rxjs';
import { ApiService, OrderHistory } from '../services/api.service';

@Component({
  selector: 'app-rejected',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rejected.component.html',
  styleUrl: './rejected.component.scss',
})
export class RejectedComponent implements OnInit, OnDestroy {
  orders: OrderHistory[] = [];
  loading = true;
  error = '';
  private poll?: Subscription;

  constructor(private api: ApiService) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.poll?.unsubscribe(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.listOrders().subscribe({
      next: d => {
        this.orders = (d || []).filter(o =>
          this.isRejected(o) || o.status === 'failed'
        );
        this.loading = false;
      },
      error: () => { this.error = '載入失敗'; this.loading = false; },
    });
  }

  private isRejected(o: OrderHistory): boolean {
    if (!o.fill_status) return false;
    const s = o.fill_status.replace(/\s+/g, ' ').trim();
    return /[A-Z]{2,4}\d+|拒絕|不足|保金|保證金不足|無足夠|非內期|超限/.test(s);
  }

  /** 解析 fill_status，回傳清理後的文字 */
  parseFill(fill: string | undefined): string {
    if (!fill) return '—';
    return fill.replace(/\s+/g, ' ').trim();
  }

  getSourceLabel(o: OrderHistory): string {
    switch (o.source) {
      case 'signal':  return 'TradingView';
      case 'manual':  return '手動下單';
      case 'webhook': return 'Webhook';
      case 'sync':    return '外部回補';
      default:        return o.source ?? '—';
    }
  }
  getSourceClass(o: OrderHistory): string {
    if (o.source === 'signal')  return 'info';
    if (o.source === 'manual')  return 'warning';
    return '';
  }

  getBrokerLabel(o: OrderHistory): string {
    if (!o.order_result) return o.error_message ? '連線失敗' : '未送出';
    try {
      const r = JSON.parse(o.order_result);
      if (r.issend === false) return '券商拒絕';
      return `已送出 #${o.order_id ?? ''}`.trim();
    } catch { return '已送出'; }
  }
  getBrokerClass(o: OrderHistory): string {
    if (!o.order_result) return o.error_message ? 'error' : 'warning';
    try {
      const r = JSON.parse(o.order_result);
      return r.issend === false ? 'error' : 'success';
    } catch { return 'success'; }
  }
  getBrokerDetail(o: OrderHistory): string {
    if (o.error_message) return o.error_message;
    if (!o.order_result) return '';
    try {
      const r = JSON.parse(o.order_result);
      return ((r.errormsg || r.errorcode || '') as string).trim();
    } catch { return ''; }
  }
}
