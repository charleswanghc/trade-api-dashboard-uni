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

  private readonly TW_MONTH_CODES = 'ABCDEFGHIJKL';
  // CME 月份代碼：F=1, G=2, H=3, J=4, K=5, M=6, N=7, Q=8, U=9, V=10, X=11, Z=12
  private readonly CME_MONTH_CODES = ['F','G','H','J','K','M','N','Q','U','V','X','Z'];

  private buildProductSuggestions(): void {
    const now = new Date();

    // 台灣期交所商品
    const twProducts = [
      { prefix: 'TXF', name: '台指期', allMonths: true },
      { prefix: 'MXF', name: '小台指', allMonths: true },
      { prefix: 'TMF', name: '微型台指', allMonths: true },
      { prefix: 'EXF', name: '電子期', allMonths: true },
      { prefix: 'FXF', name: '金融期', allMonths: true },
      { prefix: 'XJF', name: '非金電期', allMonths: false },
      { prefix: 'BRN', name: '布蘭特原油期', allMonths: true },
    ];

    // CME 海外期貨商品（季月：3/6/9/12）
    const cmeProducts = [
      { prefix: 'MNQ', name: '微型NQ那斯達克' },
    ];

    const suggestions: { code: string; label: string }[] = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = d.getMonth() + 1;
      const isQuarterly = [3, 6, 9, 12].includes(month);
      const label = `${d.getFullYear()}/${String(month).padStart(2, '0')}`;

      // 台灣期交所：年份取個位數
      const twYearCode = d.getFullYear() % 10;
      const twMonthCode = this.TW_MONTH_CODES[month - 1];
      for (const p of twProducts) {
        if (!p.allMonths && !isQuarterly) continue;
        suggestions.push({ code: `${p.prefix}${twMonthCode}${twYearCode}`, label: `[台] ${p.name} ${label}` });
      }

      // CME：僅季月，年份取後兩位
      if (isQuarterly) {
        const cmeYearCode = String(d.getFullYear()).slice(-2);
        const cmeMonthCode = this.CME_MONTH_CODES[month - 1];
        for (const p of cmeProducts) {
          suggestions.push({ code: `${p.prefix}${cmeMonthCode}${cmeYearCode}`, label: `[CME] ${p.name} ${label}` });
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
}
