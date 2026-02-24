import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  health: any;
  strategyCount: number | null = null;
  todaySignals: number | null = null;
  recentSignals: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.health().subscribe(d => (this.health = d));
    this.api.getStrategies(true).subscribe(d => (this.strategyCount = d.length));
    this.api.getSignals(200).subscribe(d => {
      this.recentSignals = d.slice(0, 5);
      const today = new Date().toDateString();
      this.todaySignals = d.filter((s: any) =>
        new Date(s.created_at).toDateString() === today
      ).length;
    });
  }

  getSignalClass(type: string): string {
    if (type?.includes('entry')) return 'success';
    if (type?.includes('exit')) return 'warning';
    return 'info';
  }
}
