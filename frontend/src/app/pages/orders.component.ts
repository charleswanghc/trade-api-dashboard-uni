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
