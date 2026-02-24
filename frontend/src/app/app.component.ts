import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <nav>
      <div class="nav-inner">
        <div class="brand">期貨自動交易 Dashboard</div>
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/strategies" routerLinkActive="active">策略管理</a>
        <a routerLink="/orders" routerLinkActive="active">Orders</a>
        <a routerLink="/positions" routerLinkActive="active">Positions</a>
        <a routerLink="/trades" routerLinkActive="active">Trades</a>
        <a routerLink="/alerts" routerLinkActive="active">Alerts</a>
      </div>
    </nav>
    <div class="container">
      <router-outlet />
    </div>
  `
})
export class AppComponent {}
