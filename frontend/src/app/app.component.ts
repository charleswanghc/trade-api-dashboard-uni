import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="app-shell">

      <!-- ── 左側邊欄 ── -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">📈</div>
          <div>
            <div class="sidebar-brand-name">期貨自動交易</div>
            <div class="sidebar-brand-sub">Auto Trading System</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section">主要功能</div>
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">⊞</span><span>系統總覽</span>
          </a>
          <a routerLink="/strategies" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">⚙</span><span>策略管理</span>
          </a>
          <a routerLink="/orders" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">⇅</span><span>手動下單</span>
          </a>

          <div class="nav-section" style="margin-top:6px">監控</div>
          <a routerLink="/positions" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">◉</span><span>未平倉部位</span>
          </a>
          <a routerLink="/trades" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">↺</span><span>成交紀錄</span>
          </a>
          <a routerLink="/alerts" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">◎</span><span>訊號記錄</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="status-indicator">
            <span class="status-dot"></span>
            <span>系統運行中</span>
          </div>
        </div>
      </aside>

      <!-- ── 主要區域 ── -->
      <div class="main-area">
        <header class="top-bar">
          <div class="top-bar-title">{{ pageTitle }}</div>
          <div class="clock">{{ currentTime }}</div>
        </header>
        <main class="content">
          <router-outlet />
        </main>
      </div>

    </div>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  currentTime = '';
  pageTitle = '系統總覽';

  private timer: any;
  private routerSub!: Subscription;

  private readonly titles: Record<string, string> = {
    '/dashboard':  '系統總覽',
    '/strategies': '策略管理',
    '/orders':     '手動下單',
    '/positions':  '未平倉部位',
    '/trades':     '成交紀錄',
    '/alerts':     '訊號記錄',
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.updateTime();
    this.timer = setInterval(() => this.updateTime(), 1000);
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.pageTitle = this.titles[e.urlAfterRedirects] ?? '期貨自動交易';
      });
    this.pageTitle = this.titles[this.router.url] ?? '期貨自動交易';
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    this.routerSub?.unsubscribe();
  }

  private updateTime(): void {
    this.currentTime = new Date().toLocaleTimeString('zh-TW', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
}
