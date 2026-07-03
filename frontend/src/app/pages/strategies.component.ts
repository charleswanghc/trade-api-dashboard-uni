import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, StrategyConfig } from '../services/api.service';

@Component({
  selector: 'app-strategies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './strategies.component.html',
  styleUrl: './strategies.component.scss',
})
export class StrategiesComponent implements OnInit {
  strategies: StrategyConfig[] = [];
  showForm = false;
  isEditing = false;
  loading = false;
  error = '';

  currentStrategy: Partial<StrategyConfig> = this.getEmptyStrategy();

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadStrategies();
  }

  loadStrategies() {
    this.loading = true;
    this.error = '';
    this.api.getStrategies().subscribe({
      next: (data) => {
        this.strategies = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = '載入策略失敗：' + err.message;
        this.loading = false;
      }
    });
  }

  showCreateForm() {
    this.currentStrategy = this.getEmptyStrategy();
    this.isEditing = false;
    this.showForm = true;
  }

  editStrategy(strategy: StrategyConfig) {
    this.currentStrategy = { ...strategy };
    this.isEditing = true;
    this.showForm = true;
  }

  saveStrategy() {
    if (this.isEditing) {
      this.api.updateStrategy(this.currentStrategy.strategy_name!, this.currentStrategy as any).subscribe({
        next: () => {
          this.loadStrategies();
          this.cancelForm();
        },
        error: (err) => {
          this.error = '更新策略失敗：' + err.message;
        }
      });
    } else {
      this.api.createStrategy(this.currentStrategy as any).subscribe({
        next: () => {
          this.loadStrategies();
          this.cancelForm();
        },
        error: (err) => {
          this.error = '建立策略失敗：' + err.message;
        }
      });
    }
  }

  cancelForm() {
    this.showForm = false;
    this.currentStrategy = this.getEmptyStrategy();
    this.error = '';
  }

  toggleStrategy(name: string) {
    this.api.toggleStrategy(name).subscribe({
      next: () => {
        this.loadStrategies();
      },
      error: (err) => {
        this.error = '切換策略狀態失敗：' + err.message;
      }
    });
  }

  deleteStrategy(name: string) {
    if (confirm(`確定要刪除策略 "${name}" 嗎？`)) {
      this.api.deleteStrategy(name).subscribe({
        next: () => {
          this.loadStrategies();
        },
        error: (err) => {
          this.error = '刪除策略失敗：' + err.message;
        }
      });
    }
  }

  getEmptyStrategy(): Partial<StrategyConfig> {
    return {
      strategy_name: '',
      source_product: 'TXF',
      target_product: 'MXF',
      quantity_multiplier: 1,
      max_position: 10,
      order_type: 'L',
      order_condition: 'R',
      dtrade: 'N',
      entry_order_type: 'M',
      entry_order_condition: 'I',
      exit_order_type: 'M',
      exit_order_condition: 'I',
      account: '',
      sub_account: '',
      enabled: true,
      auto_rollover: true,
      description: ''
    };
  }

  getOrderTypeLabel(type: string): string {
    const labels: any = { L: '限價', M: '市價', P: '範圍市價' };
    return labels[type] || type;
  }

  getConditionLabel(condition: string): string {
    const labels: any = { R: 'ROD', I: 'IOC', F: 'FOK' };
    return labels[condition] || condition;
  }

  formatDate(date: string): string {
    return new Date(date + 'Z').toLocaleString('zh-TW');
  }

  /**
   * 計算 TAIFEX 近月合約代碼（與後端邏輯一致）。
   * 月份代碼：A=1月 B=2月 ... F=6月 G=7月 ... L=12月
   * 到期日：每月第三個週三
   */
  getCurrentContract(baseCode: string): string {
    if (!baseCode || baseCode.length < 2) return '';
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // 1-12

    // 找出本月第三個週三
    const firstDay = new Date(year, month - 1, 1);
    const dayOfWeek = firstDay.getDay(); // 0=Sun, 3=Wed
    const daysUntilWed = (3 - dayOfWeek + 7) % 7;
    const thirdWed = new Date(year, month - 1, 1 + daysUntilWed + 14);

    let contractMonth = month;
    let contractYear = year;
    if (today > thirdWed) {
      if (month === 12) { contractMonth = 1; contractYear = year + 1; }
      else { contractMonth = month + 1; }
    }

    const monthCode = String.fromCharCode(65 + contractMonth - 1); // A=1, B=2...
    const yearCode = contractYear.toString().slice(-1);
    return `${baseCode}${monthCode}${yearCode}`;
  }

  /** 根據輸入的完整合約代碼（如 TXFF5），推測對應的微台基底代碼 MXF */
  suggestMxfBase(input: string): string {
    if (!input) return '';
    const upper = input.toUpperCase();
    if (upper.startsWith('TXF')) return 'MXF';
    return upper.replace(/[A-L]\d$/, ''); // 去掉月份+年份後綴
  }
}
