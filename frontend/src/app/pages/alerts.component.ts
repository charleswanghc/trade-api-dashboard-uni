import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, SignalHistory } from '../services/api.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss',
})
export class AlertsComponent implements OnInit {
  signals: SignalHistory[] = [];
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadSignals();
  }

  loadSignals(): void {
    this.loading = true;
    this.api.getSignals(100).subscribe({
      next: d => { this.signals = d; this.loading = false; },
      error: () => { this.signals = []; this.loading = false; },
    });
  }

  getSignalClass(type: string): string {
    if (type?.includes('entry')) return 'success';
    if (type?.includes('exit')) return 'warning';
    return 'info';
  }
}
