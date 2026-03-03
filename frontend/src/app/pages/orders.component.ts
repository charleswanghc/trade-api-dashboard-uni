import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent implements OnInit {
  orders: any[] = [];
  message = '';
  loading = false;
  productSuggestions: { code: string; label: string }[] = [];

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
    this.api.listOrders().subscribe((data) => (this.orders = data || []));
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
