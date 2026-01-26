import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="grid grid-2">
      <div class="card">
        <h2>手動下單</h2>
        <form [formGroup]="orderForm" (ngSubmit)="submit()">
          <div class="grid">
            <div>
              <label>帳號 (actno)</label>
              <input formControlName="actno" placeholder="1234567" />
            </div>
            <div>
              <label>子帳 (subactno)</label>
              <input formControlName="subactno" placeholder="" />
            </div>
            <div>
              <label>商品代碼 (productid)</label>
              <input formControlName="productid" placeholder="TXFF5" />
            </div>
            <div>
              <label>買賣別 (bs)</label>
              <select formControlName="bs">
                <option value="B">B</option>
                <option value="S">S</option>
              </select>
            </div>
            <div>
              <label>下單方式 (ordertype)</label>
              <select formControlName="ordertype">
                <option value="L">L</option>
                <option value="M">M</option>
                <option value="P">P</option>
              </select>
            </div>
            <div>
              <label>委託價格 (price)</label>
              <input type="number" formControlName="price" />
            </div>
            <div>
              <label>委託口數 (orderqty)</label>
              <input type="number" formControlName="orderqty" />
            </div>
            <div>
              <label>委託種類 (ordercondition)</label>
              <select formControlName="ordercondition">
                <option value="R">R</option>
                <option value="I">I</option>
                <option value="F">F</option>
              </select>
            </div>
            <div>
              <label>新平倉碼 (opencloseflag)</label>
              <select formControlName="opencloseflag">
                <option value="">自動</option>
                <option value="0">0</option>
                <option value="1">1</option>
              </select>
            </div>
            <div>
              <label>當沖碼 (dtrade)</label>
              <select formControlName="dtrade">
                <option value="N">N</option>
                <option value="Y">Y</option>
              </select>
            </div>
            <div>
              <label>備註 (note, <=10字)</label>
              <input formControlName="note" placeholder="ordertest" />
            </div>
            <div>
              <label>策略</label>
              <input formControlName="strategy" placeholder="EMA_CROSS" />
            </div>
          </div>
          <div style="margin-top: 12px; display: flex; gap: 12px;">
            <button class="btn" type="submit" [disabled]="orderForm.invalid || loading">送出</button>
            <button class="btn secondary" type="button" (click)="loadOrders()">重新整理</button>
          </div>
        </form>
        <p *ngIf="message" style="margin-top: 12px;">{{ message }}</p>
      </div>
      <div class="card">
        <h2>最近訂單</h2>
        <div *ngIf="orders.length; else empty">
          <div *ngFor="let order of orders" style="padding: 8px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.15);">
            <div>{{ order.symbol }} / {{ order.action }} / {{ order.quantity }} / {{ order.source }}</div>
            <div style="color: var(--muted); font-size: 12px;">
              {{ order.created_at }} · {{ order.status }} · {{ order.order_id || order.order_result }}
            </div>
          </div>
        </div>
        <ng-template #empty>尚無訂單。</ng-template>
      </div>
    </div>
  `
})
export class OrdersComponent implements OnInit {
  orders: any[] = [];
  message = '';
  loading = false;

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
