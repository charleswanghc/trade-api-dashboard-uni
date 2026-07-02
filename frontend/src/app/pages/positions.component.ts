import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Position, Unliquidation } from '../services/api.service';

@Component({
  selector: 'app-positions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './positions.component.html',
  styleUrl: './positions.component.scss',
})
export class PositionsComponent implements OnInit {
  positions: Position[] = [];
  unliquidations: Unliquidation[] = [];
  loading = false;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    // 使用 get_position（即時部位）作為主要資料來源
    this.api.getPositions().subscribe({
      next: (data) => {
        this.positions = data;
        this.loading = false;
      },
      error: (err) => {
        // fallback：改用 get_unliquidation
        this.api.getUnliquidations().subscribe({
          next: (u) => { this.unliquidations = u; this.loading = false; },
          error: (e) => {
            const raw = e?.error?.detail || err?.error?.detail;
            this.error = (e?.status === 0 || err?.status === 0)
              ? '帳務查詢服務暫不可用（可能需申請帳務查詢權限）'
              : raw || '載入失敗';
            this.loading = false;
          },
        });
      },
    });

    this.api.getUnliquidations().subscribe({
      next: (data) => (this.unliquidations = data),
      error: () => {},
    });
  }

  /** 計算淨留倉口數（買 - 賣）*/
  netQty(pos: Position): number {
    return (pos.buy_open_qty ?? 0) - (pos.sell_open_qty ?? 0);
  }

  pnlClass(pnl: number | undefined): string {
    if (!pnl) return '';
    return pnl > 0 ? 'pnl-positive' : pnl < 0 ? 'pnl-negative' : '';
  }

  bsLabel(bs: string | undefined): string {
    if (bs === 'B') return '買進';
    if (bs === 'S') return '賣出';
    return bs ?? '–';
  }

  hasPositions(): boolean {
    return this.positions.some(
      (p) => (p.buy_open_qty ?? 0) > 0 || (p.sell_open_qty ?? 0) > 0
    );
  }
}
