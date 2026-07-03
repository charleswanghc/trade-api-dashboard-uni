import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, timer, of, forkJoin } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ApiService, Margin, OrderHistory, SignalHistory } from '../services/api.service';

const HEALTH_POLL_MS = 30_000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  health: any = null;
  healthError = false;
  lastChecked: Date | null = null;
  strategyCount: number | null = null;
  todaySignals: number | null = null;
  recentSignals: SignalHistory[] = [];
  recentOrders: OrderHistory[] = [];
  orderMap = new Map<string, OrderHistory>();
  unitradeStatus: string | null = null;

  private readonly FINAL_STATUSES = new Set(['filled', 'cancelled', 'failed']);
  private orderPoll?: Subscription;
  margin: Margin | null = null;
  marginError = false;
  marginErrorMsg = '';
  marginLoading = false;

  private healthPoll?: Subscription;
  /** 上一次偵測到的 unitrade 狀態，用來判斷是否剛連上 */
  private prevUnitradeStatus: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    // 單一 30s timer 同時輪詢 /health + /health/unitrade
    // 保證金只在 Unitrade 從非連線 → connected 的瞬間自動查詢一次，
    // 其餘情況需手動按「重整」或重新進入頁面
    this.healthPoll = timer(0, HEALTH_POLL_MS)
      .pipe(
        switchMap(() =>
          forkJoin({
            health: this.api.health().pipe(catchError(() => of(null))),
            unitrade: this.api.healthUnitrade().pipe(
              catchError(() => of({ unitrade: 'disconnected' }))
            ),
          })
        )
      )
      .subscribe(({ health, unitrade }) => {
        // — health —
        this.lastChecked = new Date();
        if (health === null) {
          this.healthError = true;
          this.health = null;
        } else {
          this.healthError = false;
          this.health = health;
        }

        // — unitrade 狀態 —
        const status = (unitrade as any)?.unitrade ?? 'disconnected';
        // 只在「剛恢復連線」時自動補查一次保證金
        if (status === 'connected' && this.prevUnitradeStatus !== null && this.prevUnitradeStatus !== 'connected') {
          this.loadMargin();
        }
        this.prevUnitradeStatus = status;
        this.unitradeStatus = status;
      });

    // 進入頁面時載入一次保證金
    this.loadMargin();

    // 只在進入頁面時載入一次
    this.api.getStrategies(true).subscribe({
      next: d => (this.strategyCount = d.length),
      error: () => (this.strategyCount = 0),
    });
    this.api.getSignals(20).subscribe({
      next: d => {
        this.recentSignals = d.slice(0, 5);
        const today = new Date().toDateString();
        this.todaySignals = d.filter((s: any) =>
          new Date(s.created_at).toDateString() === today
        ).length;
      },
      error: () => {
        this.recentSignals = [];
        this.todaySignals = 0;
      },
    });
    this.api.listOrders().subscribe({
      next: d => {
        const all = d || [];
        this.recentOrders = all.slice(0, 5);
        this.orderMap = new Map(all.filter(o => o.order_id).map(o => [o.order_id!, o]));
        this.startOrderPolling();
      },
      error: () => (this.recentOrders = []),
    });
  }

  /** 有非終態訂單時每 3 秒輪詢，直到全部終結或元件銷毀 */
  private startOrderPolling(): void {
    this.orderPoll?.unsubscribe();
    if (!this.recentOrders.some(o => !this.FINAL_STATUSES.has(o.status))) return;
    this.orderPoll = timer(3000, 3000).subscribe(() => {
      this.api.listOrders().subscribe({
        next: d => {
          const all = d || [];
          this.recentOrders = all.slice(0, 5);
          this.orderMap = new Map(all.filter(o => o.order_id).map(o => [o.order_id!, o]));
          if (!this.recentOrders.some(o => !this.FINAL_STATUSES.has(o.status))) {
            this.orderPoll?.unsubscribe();
          }
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.healthPoll?.unsubscribe();
    this.orderPoll?.unsubscribe();
  }

  loadMargin(): void {
    if (this.marginLoading) return;
    this.marginLoading = true;
    this.api.getMargin().subscribe({
      next: (data) => {
        this.margin = data && data.length > 0 ? data[0] : null;
        this.marginError = false;
        this.marginErrorMsg = '';
        this.marginLoading = false;
      },
      error: (err) => {
        this.marginError = true;
        // status 0 = 瀏覽器 CORS 或網路層錯誤，通常是帳務查詢權限未開放
        if (err?.status === 0) {
          this.marginErrorMsg = '帳務查詢服務暫不可用（可能需申請帳務查詢權限）';
        } else {
          this.marginErrorMsg = err?.error?.detail ?? err?.message ?? '查詢失敗';
        }
        this.marginLoading = false;
      },
    });
  }

  pnlClass(v: number | undefined): string {
    if (v == null) return '';
    return v > 0 ? 'text-success' : v < 0 ? 'text-danger' : '';
  }

  getSignalClass(type: string): string {
    if (type?.includes('entry')) return 'success';
    if (type?.includes('exit')) return 'warning';
    return 'info';
  }

  // ── 訊號四段流程 helpers ───────────────────────────────────────
  getSignalPlatformClass(signal: SignalHistory): string {
    if (signal.status === 'processed' || signal.status === 'ok') return 'success';
    if (signal.status === 'failed' || signal.status === 'error') return 'error';
    if (signal.status === 'ignored') return 'warning';
    return 'info';
  }
  getSignalPlatformLabel(signal: SignalHistory): string {
    if (signal.status === 'processed' || signal.status === 'ok') return '已處理';
    if (signal.status === 'failed' || signal.status === 'error') return '轉單失敗';
    if (signal.status === 'ignored') return '已忽略';
    return '處理中';
  }
  getSignalBrokerClass(signal: SignalHistory): string {
    if (signal.status === 'ignored') return 'warning';
    const order = signal.order_id ? this.orderMap.get(signal.order_id) : undefined;
    if (order) return this.getOrderBrokerClass(order);
    if (signal.order_id) return 'success';
    if (signal.status === 'failed' || signal.status === 'error') return 'error';
    return 'warning';
  }
  getSignalBrokerLabel(signal: SignalHistory): string {
    if (signal.status === 'ignored') return '已忽略';
    if (signal.order_id) return `已送出 #${signal.order_id}`;
    if (signal.status === 'failed' || signal.status === 'error') return '轉單失敗';
    return '等待中';
  }
  getSignalBrokerDetail(signal: SignalHistory): string {
    const order = signal.order_id ? this.orderMap.get(signal.order_id) : undefined;
    if (order) return this.getOrderBrokerDetail(order);
    return signal.error_message ?? '';
  }
  getSignalExchangeClass(signal: SignalHistory): string {
    const order = signal.order_id ? this.orderMap.get(signal.order_id) : undefined;
    if (order) return this.getOrderExchangeClass(order);
    if (signal.order_id) return 'warning';
    return '';
  }
  getSignalExchangeLabel(signal: SignalHistory): string {
    const order = signal.order_id ? this.orderMap.get(signal.order_id) : undefined;
    if (order) return this.getOrderExchangeLabel(order);
    if (signal.order_id) return '等待回報';
    return '—';
  }
  getSignalExchangeDetail(signal: SignalHistory): string {
    const order = signal.order_id ? this.orderMap.get(signal.order_id) : undefined;
    if (order) return this.getOrderExchangeDetail(order);
    return '';
  }

  // ── 訂單四段流程 helpers ───────────────────────────────────────
  getOrderSourceLabel(order: OrderHistory): string {
    switch (order.source) {
      case 'signal':  return 'TradingView';
      case 'manual':  return '手動下單';
      case 'webhook': return 'Webhook';
      case 'sync':    return '外部回補';
      default:        return order.source ?? '—';
    }
  }
  getOrderSourceClass(order: OrderHistory): string {
    if (order.source === 'signal')  return 'info';
    if (order.source === 'manual')  return 'warning';
    return '';
  }

  private _orderBrokerResult(order: OrderHistory): { issend: boolean | null; errormsg: string } {
    if (!order.order_result) return { issend: null, errormsg: order.error_message ?? '' };
    try {
      const r = JSON.parse(order.order_result);
      return {
        issend: typeof r.issend === 'boolean' ? r.issend : null,
        errormsg: (r.errormsg || r.errorcode || '').trim(),
      };
    } catch { return { issend: null, errormsg: order.error_message ?? '' }; }
  }

  getOrderBrokerClass(order: OrderHistory): string {
    const { issend } = this._orderBrokerResult(order);
    if (issend === true)  return 'success';
    if (issend === false) return 'error';
    return order.error_message ? 'error' : 'warning';
  }
  getOrderBrokerLabel(order: OrderHistory): string {
    const { issend } = this._orderBrokerResult(order);
    if (issend === true)  return `已送出${order.order_id ? ' #' + order.order_id : ''}`;
    if (issend === false) return '券商拒絕';
    return order.error_message ? '連線失敗' : '等待中';
  }
  getOrderBrokerDetail(order: OrderHistory): string {
    const { issend, errormsg } = this._orderBrokerResult(order);
    if (issend === false) return errormsg || '不明原因';
    return order.error_message ?? '';
  }

  private _parseFillStatus(fill: string | undefined): { isReject: boolean; text: string } {
    if (!fill) return { isReject: false, text: '' };
    const cleaned = fill.replace(/\s+/g, ' ').trim();
    const isReject = /PSC\d+|拒絕|不足|保金|保證金不足/.test(cleaned);
    return { isReject, text: cleaned };
  }

  getOrderExchangeClass(order: OrderHistory): string {
    const { isReject } = this._parseFillStatus(order.fill_status);
    if (isReject) return 'error';
    if (order.fill_status?.includes('完全成交') || order.status === 'filled') return 'success';
    if (order.fill_status?.includes('成功')) return 'success';
    if (order.fill_status?.includes('刪單') || order.fill_status?.includes('取消')) return 'warning';
    const { issend } = this._orderBrokerResult(order);
    if (issend === true) return 'warning';
    return '';
  }
  getOrderExchangeLabel(order: OrderHistory): string {
    const { isReject } = this._parseFillStatus(order.fill_status);
    if (isReject) return '拒單';
    if (!order.fill_status) return this._orderBrokerResult(order).issend === true ? '等待回報' : '未送達';
    if (order.fill_status.includes('完全成交')) return '完全成交';
    if (order.fill_status.includes('部分')) return '部分成交';
    if (order.fill_status.includes('刪單')) return '已刪單';
    return order.fill_status.split(':')[0].trim() || order.fill_status;
  }
  getOrderExchangeDetail(order: OrderHistory): string {
    const { isReject, text } = this._parseFillStatus(order.fill_status);
    if (isReject) return text;
    if (order.fill_quantity && order.fill_quantity > 0) {
      const p = order.fill_price ? ` @ ${order.fill_price}` : '';
      return `成交 ${order.fill_quantity} 口${p}`;
    }
    return '';
  }
}
