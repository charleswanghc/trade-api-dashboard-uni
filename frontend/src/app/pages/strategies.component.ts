import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, StrategyConfig } from '../services/api.service';

interface ProductOption {
  code: string;
  name: string;
}

interface TargetOption extends ProductOption {
  value: string;
  contractMonth?: string;
}

// 期交所商品代碼：https://www.taifex.com.tw/cht/4/contractName
const PRODUCT_FAMILIES: ProductOption[][] = [
  [{ code: 'TXF', name: '臺股期貨' }, { code: 'MXF', name: '小型臺指期貨' }, { code: 'TMF', name: '微型臺指期貨' }],
  [{ code: 'EXF', name: '電子期貨' }, { code: 'ZEF', name: '小型電子期貨' }],
  [{ code: 'FXF', name: '金融期貨' }, { code: 'ZFF', name: '小型金融期貨' }],
  [{ code: 'CDF', name: '台積電期貨' }, { code: 'QFF', name: '小型台積電期貨' }],
  [{ code: 'NYF', name: '元大台灣50ETF期貨' }, { code: 'SRF', name: '小型元大台灣50ETF期貨' }],
  [{ code: 'T5F', name: '臺灣50期貨' }],
  [{ code: 'GTF', name: '櫃買期貨' }],
  [{ code: 'G2F', name: '富櫃200期貨' }],
  [{ code: 'XIF', name: '非金電期貨' }],
  [{ code: 'SOF', name: '半導體30期貨' }],
  [{ code: 'SHF', name: '航運期貨' }],
];

@Component({
  selector: 'app-strategies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './strategies.component.html',
  styleUrl: './strategies.component.scss',
})
export class StrategiesComponent implements OnInit {
  readonly sourceProducts = PRODUCT_FAMILIES.flat();
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

  private baseCode(product: string): string {
    const code = product.trim().toUpperCase();
    if (this.sourceProducts.some((item) => item.code === code)) return code;
    const withoutMonth = code.replace(/[A-L]\d$/, '');
    return this.sourceProducts.some((item) => item.code === withoutMonth) ? withoutMonth : code;
  }

  private productFamily(source: string): ProductOption[] {
    const base = this.baseCode(source);
    return PRODUCT_FAMILIES.find((family) => family.some((item) => item.code === base)) || [];
  }

  get targetProducts(): ProductOption[] {
    return this.productFamily(this.currentStrategy.source_product || '');
  }

  onSourceProductChange(source: string): void {
    const family = this.productFamily(source);
    if (!family.length) return;

    const currentTarget = this.currentStrategy.target_product || '';
    const selectedBase = this.baseCode(source);
    const targetBase = family.some((item) => item.code === this.baseCode(currentTarget))
      ? this.baseCode(currentTarget)
      : selectedBase;
    const sourceSuffix = source.trim().toUpperCase().match(/[A-L]\d$/)?.[0];
    this.currentStrategy.target_product = this.currentStrategy.auto_rollover
      ? targetBase
      : currentTarget.startsWith(targetBase) && /[A-L]\d$/.test(currentTarget)
        ? currentTarget
        : sourceSuffix ? targetBase + sourceSuffix : this.getCurrentContract(targetBase);
  }

  onAutoRolloverChange(enabled: boolean): void {
    const target = this.currentStrategy.target_product || '';
    const base = this.baseCode(target);
    if (!this.sourceProducts.some((item) => item.code === base)) return;

    const sourceSuffix = (this.currentStrategy.source_product || '').trim().toUpperCase().match(/[A-L]\d$/)?.[0];
    this.currentStrategy.target_product = enabled
      ? base
      : sourceSuffix ? base + sourceSuffix : this.getCurrentContract(base);
  }

  get targetOptions(): TargetOption[] {
    const products = this.targetProducts;
    if (this.currentStrategy.auto_rollover) {
      return products.map((item) => ({ ...item, value: item.code }));
    }

    const today = new Date();
    let frontMonth = today.getMonth();
    const firstDay = new Date(today.getFullYear(), frontMonth, 1).getDay();
    const thirdWednesday = 1 + (3 - firstDay + 7) % 7 + 14;
    if (today.getDate() > thirdWednesday) frontMonth++;

    const suffixes = new Map<string, string>();
    for (let offset = 0; offset < 6; offset++) {
      const date = new Date(today.getFullYear(), frontMonth + offset, 1);
      const suffix = String.fromCharCode(65 + date.getMonth()) + (date.getFullYear() % 10);
      suffixes.set(suffix, date.getFullYear() + '/' + String(date.getMonth() + 1).padStart(2, '0'));
    }
    for (const code of [this.currentStrategy.source_product, this.currentStrategy.target_product]) {
      const suffix = (code || '').toUpperCase().match(/[A-L]\d$/)?.[0];
      if (suffix && !suffixes.has(suffix)) suffixes.set(suffix, '既有合約');
    }

    return products.flatMap((item) => Array.from(suffixes, ([suffix, contractMonth]) => ({
      ...item,
      value: item.code + suffix,
      contractMonth,
    })));
  }

  get targetIsListed(): boolean {
    return this.targetOptions.some((item) => item.value === this.currentStrategy.target_product);
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
    if (today.getDate() > thirdWed.getDate()) {
      if (month === 12) { contractMonth = 1; contractYear = year + 1; }
      else { contractMonth = month + 1; }
    }

    const monthCode = String.fromCharCode(65 + contractMonth - 1); // A=1, B=2...
    const yearCode = contractYear.toString().slice(-1);
    return `${baseCode}${monthCode}${yearCode}`;
  }


}
