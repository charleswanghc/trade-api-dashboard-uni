import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, timer, of, forkJoin } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ApiService, Margin } from '../services/api.service';

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
  recentSignals: any[] = [];
  unitradeStatus: string | null = null;
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
  }

  ngOnDestroy(): void {
    this.healthPoll?.unsubscribe();
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
}
