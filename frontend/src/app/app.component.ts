import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
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
