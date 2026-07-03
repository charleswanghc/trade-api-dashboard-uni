import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard.component';
import { OrdersComponent } from './pages/orders.component';
import { PositionsComponent } from './pages/positions.component';
import { TradesComponent } from './pages/trades.component';
import { AlertsComponent } from './pages/alerts.component';
import { StrategiesComponent } from './pages/strategies.component';
import { RejectedComponent } from './pages/rejected.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'orders', component: OrdersComponent },
  { path: 'positions', component: PositionsComponent },
  { path: 'trades', component: TradesComponent },
  { path: 'alerts', component: AlertsComponent },
  { path: 'rejected', component: RejectedComponent },
  { path: 'strategies', component: StrategiesComponent }
];
