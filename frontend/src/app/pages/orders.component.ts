import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { ApiService, OrderHistory } from '../services/api.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit, OnDestroy {
  orders: OrderHistory[] = [];
  sourceFilter: 'manual' | 'all' = 'manual';  // 手動下單頁預設只顯示手動單
  message = '';
  loading = false;
  productSuggestions: { code: string; label: string }[] = [];

  private readonly FINAL_STATUSES = new Set(['filled', 'cancelled', 'failed']);
  private orderPoll?: Subscription;

  // ─── 商品代碼查詢器 ───
  showLookup = false;
  lookupTab: 'tw' | 'foreign' = 'tw';
  lookupFilter = '';
  lookupData: any[] = [];
  lookupFilteredData: any[] = [];
  lookupLoading = false;
  lookupError = '';

  private readonly TW_MONTH_CODES = 'ABCDEFGHIJKL';
  // CME/CBT/CMX 月份代碼：F=1,G=2,H=3,J=4,K=5,M=6,N=7,Q=8,U=9,V=10,X=11,Z=12
  private readonly US_MONTH_CODES = ['F','G','H','J','K','M','N','Q','U','V','X','Z'];

  private buildProductSuggestions(): void {
    const now = new Date();

    // 台灣期交所：年份個位數，每月合約
    const twProducts = [
      { prefix: 'TXF', name: '台指期' },
      { prefix: 'MXF', name: '小台指' },
      { prefix: 'TMF', name: '微型台指' },
      { prefix: 'CDF', name: '台積電期貨' },
      { prefix: 'QFF', name: '小型台積電期貨' },
    ];

    // 美國交易所：僅季月（3/6/9/12），年份後兩位
    const usProducts = [
      { prefix: 'NQ',  name: '那斯達克',      exchange: 'CME' },
      { prefix: 'MNQ', name: '微型那斯達克',  exchange: 'CME' },
      { prefix: 'ZG',  name: '大黃金',        exchange: 'CBT' },
      { prefix: 'YG',  name: '小黃金',        exchange: 'CBT' },
      { prefix: '1OZ', name: '一盎司黃金',    exchange: 'CMX' },
    ];

    const suggestions: { code: string; label: string }[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = d.getMonth() + 1;
      const isQuarterly = [3, 6, 9, 12].includes(month);
      const label = `${d.getFullYear()}/${String(month).padStart(2, '0')}`;

      // 台灣期交所
      const twYearCode = d.getFullYear() % 10;
      const twMonthCode = this.TW_MONTH_CODES[month - 1];
      for (const p of twProducts) {
        suggestions.push({ code: `${p.prefix}${twMonthCode}${twYearCode}`, label: `[台] ${p.name} ${label}` });
      }

      // 美國交易所（僅季月）
      if (isQuarterly) {
        const usYearCode = String(d.getFullYear()).slice(-2);
        const usMonthCode = this.US_MONTH_CODES[month - 1];
        for (const p of usProducts) {
          suggestions.push({ code: `${p.prefix}${usMonthCode}${usYearCode}`, label: `[${p.exchange}] ${p.name} ${label}` });
        }
      }
    }

    this.productSuggestions = suggestions;
  }

  orderForm = this.fb.group({
    actno: [''],
    subactno: [''],
    productid: ['', Validators.required],
    bs: ['B', Validators.required],
    ordertype: ['L', Validators.required],
    price: [0],
    orderqty: [1, [Validators.required, Validators.min(1)]],
    ordercondition: ['R', Validators.required],
    opencloseflag: [''],
    dtrade: ['N'],
    note: [''],
    strategy: ['']
  });

  constructor(private fb: FormBuilder, private api: ApiService) {}

  ngOnInit(): void {
    this.buildProductSuggestions();
    this.loadOrders();
  }

  submit(): void {
    if (this.orderForm.invalid) {
      return;
    }
    this.loading = true;
    this.message = '';
    this.api.placeOrder(this.orderForm.value as any).subscribe({
      next: (res) => {
        this.message = `下單結果：${res.status || 'ok'}`;
        this.loadOrders();
        this.loading = false;
      },
      error: (err) => {
        this.message = `下單失敗：${err?.error?.detail || err.message}`;
        this.loading = false;
      }
    });
  }

  loadOrders(): void {
    this.api.listOrders().subscribe((data) => {
      this.orders = data || [];
      this.startOrderPolling();
    });
  }

  get filteredOrders(): OrderHistory[] {
    return this.sourceFilter === 'all'
      ? this.orders
      : this.orders.filter(o => o.source === 'manual' || o.source === 'webhook');
  }

  /** 有非終態訂單時每 3 秒輪詢，直到全部終結或元件銷毀 */
  private startOrderPolling(): void {
    this.orderPoll?.unsubscribe();
    if (!this.orders.some(o => !this.FINAL_STATUSES.has(o.status))) return;
    this.orderPoll = timer(3000, 3000).subscribe(() => {
      this.api.listOrders().subscribe({
        next: data => {
          this.orders = data || [];
          if (!this.orders.some(o => !this.FINAL_STATUSES.has(o.status))) {
            this.orderPoll?.unsubscribe();
          }
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.orderPoll?.unsubscribe();
  }

  // ── 四段式流程揭露 helpers ───────────────────────────────────────

  getSourceLabel(order: OrderHistory): string {
    switch (order.source) {
      case 'signal':  return 'TradingView';
      case 'manual':  return '手動下單';
      case 'webhook': return 'Webhook';
      case 'sync':    return '外部回補';
      default:        return order.source ?? '—';
    }
  }
  getSourceClass(order: OrderHistory): string {
    if (order.source === 'signal')  return 'info';
    if (order.source === 'manual')  return 'warning';
    return '';
  }

  private _brokerResult(order: OrderHistory): { issend: boolean | null; errormsg: string } {
    if (!order.order_result) return { issend: null, errormsg: order.error_message ?? '' };
    try {
      const r = JSON.parse(order.order_result);
      return {
        issend: typeof r.issend === 'boolean' ? r.issend : null,
        errormsg: (r.errormsg || r.errorcode || '').trim(),
      };
    } catch { return { issend: null, errormsg: order.error_message ?? '' }; }
  }

  getBrokerClass(order: OrderHistory): string {
    const { issend } = this._brokerResult(order);
    if (issend === true)  return 'success';
    if (issend === false) return 'error';
    return order.error_message ? 'error' : 'warning';
  }
  getBrokerLabel(order: OrderHistory): string {
    const { issend } = this._brokerResult(order);
    if (issend === true)  return `已送出${order.order_id ? ' #' + order.order_id : ''}`;
    if (issend === false) return '券商拒絕';
    return order.error_message ? '連線失敗' : '等待中';
  }
  getBrokerDetail(order: OrderHistory): string {
    const { issend, errormsg } = this._brokerResult(order);
    if (issend === false) return errormsg || '不明原因';
    return order.error_message ?? '';
  }

  getExchangeClass(order: OrderHistory): string {
    const { isReject } = this.parseFillStatus(order.fill_status);
    if (isReject) return 'error';
    if (order.fill_status?.includes('完全成交') || order.status === 'filled') return 'success';
    if (order.fill_status?.includes('成功')) return 'success';
    if (order.fill_quantity && order.fill_quantity > 0) return 'success';
    if (order.fill_status?.includes('刪單') || order.fill_status?.includes('取消')) return 'warning';
    const { issend } = this._brokerResult(order);
    if (issend === true) return 'warning';
    return '';
  }
  getExchangeLabel(order: OrderHistory): string {
    const { isReject } = this.parseFillStatus(order.fill_status);
    if (isReject) return '拒單';
    if (order.fill_status?.includes('完全成交') || order.status === 'filled') return '完全成交';
    if (order.fill_status?.includes('委託成功') || order.fill_status?.includes('成功')) return '委託成功';
    if (order.fill_quantity && order.fill_quantity > 0) return '已成交';
    if (!order.fill_status) return this._brokerResult(order).issend === true ? '洗單中…' : '未送達';
    if (order.fill_status.includes('完全成交')) return '完全成交';
    if (order.fill_status.includes('部分')) return '部分成交';
    if (order.fill_status.includes('刪單') || order.fill_status.includes('刷單')) return '已刪單';
    return order.fill_status.split(':')[0].trim() || order.fill_status;
  }
  getExchangeDetail(order: OrderHistory): string {
    const { isReject, text } = this.parseFillStatus(order.fill_status);
    if (isReject) return text;
    if (order.fill_quantity && order.fill_quantity > 0) {
      const p = order.fill_price ? ` @ ${order.fill_price}` : '';
      return `成交 ${order.fill_quantity} 口${p}`;
    }
    // fill_status 不為空且未被前面模式識別時，直接展示原始內容以展露所有交易所回報
    if (order.fill_status?.trim()) return order.fill_status.replace(/\s+/g, ' ').trim();
    return '';
  }

  /** PSC 錯誤碼格式：「PSC0019:保證金不足  157291  0」，清理多餘空白後回傳 */
  private parseFillStatus(fill: string | undefined): { isReject: boolean; text: string } {
    if (!fill) return { isReject: false, text: '' };
    const cleaned = fill.replace(/\s+/g, ' ').trim();
    // 包含交易所錯誤碼（PSC/FUF/ORD/ACC…）或拒絕關鍵字
    const isReject = /[A-Z]{2,4}\d+|\u62d2絕|不足|保金|保證金不足|無足夠|非內期|超限/.test(cleaned);
    return { isReject, text: cleaned };
  }

  getOrderStateClass(order: OrderHistory): string {
    if (order.error_message || order.status === 'failed') return 'error';
    const { isReject } = this.parseFillStatus(order.fill_status);
    if (isReject) return 'error';
    if (order.fill_status?.includes('完全成交') || order.status === 'filled') return 'success';
    if (order.fill_status?.includes('成功') || order.fill_status?.includes('委託成功')) return 'success';
    if (order.status === 'submitted') return 'warning';
    return 'info';
  }

  getOrderStateLabel(order: OrderHistory): string {
    if (order.error_message || order.status === 'failed') return '送單失敗';
    const { isReject } = this.parseFillStatus(order.fill_status);
    if (isReject) return '交易所拒單';
    if (order.status === 'filled' || order.fill_status?.includes('完全成交')) return '已成交';
    if (order.fill_status?.includes('成功')) return '委託成功';
    if (order.status === 'submitted') return '已送出';
    return order.status;
  }

  getOrderStateDetail(order: OrderHistory): string {
    if (order.error_message) return order.error_message;
    const { isReject, text } = this.parseFillStatus(order.fill_status);
    if (isReject) return text;  // 直接顯示完整拒單原因，如「PSC0019: 保證金不足 157291 0」
    if (order.fill_quantity && order.fill_quantity > 0) {
      const avgPrice = order.fill_price ? `，均價 ${order.fill_price}` : '';
      return `已成交 ${order.fill_quantity} 口${avgPrice}`;
    }
    if (text) return `${text}；目前成交口數 ${order.fill_quantity ?? 0}`;
    if (order.status === 'submitted') return '委託已送至交易系統，等待成交或回報';
    return order.order_result || '—';
  }

  // ─── 商品代碼查詢器 ───
  toggleLookup(): void {
    this.showLookup = !this.showLookup;
    if (this.showLookup && this.lookupData.length === 0) {
      this.loadLookupData();
    }
  }

  setLookupTab(tab: 'tw' | 'foreign'): void {
    this.lookupTab = tab;
    this.lookupData = [];
    this.lookupFilteredData = [];
    this.lookupFilter = '';
    this.loadLookupData();
  }

  onLookupFilter(value: string): void {
    this.lookupFilter = value;
    this._applyLookupFilter();
  }

  private _applyLookupFilter(): void {
    const f = this.lookupFilter.toLowerCase();
    if (!f) {
      this.lookupFilteredData = [...this.lookupData];
      return;
    }
    this.lookupFilteredData = this.lookupData.filter(r =>
      (r.code  || '').toLowerCase().includes(f) ||
      (r.name  || '').toLowerCase().includes(f) ||
      (r.exchange || '').toLowerCase().includes(f)
    );
  }

  loadLookupData(): void {
    this.lookupLoading = true;
    this.lookupError = '';
    const obs = this.lookupTab === 'tw'
      ? this.api.getProductLookupTw()
      : this.api.getProductLookupForeign();
    obs.subscribe({
      next: (data) => {
        this.lookupData = data || [];
        this._applyLookupFilter();
        this.lookupLoading = false;
      },
      error: (err) => {
        this.lookupError = `載入失敗：${err?.error?.detail || err.message}`;
        this.lookupLoading = false;
      }
    });
  }

  selectFromLookup(code: string): void {
    this.orderForm.patchValue({ productid: code });
  }
}
