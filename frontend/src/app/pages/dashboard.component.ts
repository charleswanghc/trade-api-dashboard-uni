import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, timer, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ApiService } from '../services/api.service';

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

  private healthPoll?: Subscription;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    // 每 30 秒輕量 poll /health，後端無回應時標記離線
    this.healthPoll = timer(0, HEALTH_POLL_MS)
      .pipe(
        switchMap(() =>
          this.api.health().pipe(catchError(() => of(null)))
        )
      )
      .subscribe(d => {
        this.lastChecked = new Date();
        if (d === null) {
          this.healthError = true;
          this.health = null;
        } else {
          this.healthError = false;
          this.health = d;
        }
      });

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

  getSignalClass(type: string): string {
    if (type?.includes('entry')) return 'success';
    if (type?.includes('exit')) return 'warning';
    return 'info';
  }
}
