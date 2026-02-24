import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, StrategyConfig } from '../services/api.service';

@Component({
  selector: 'app-strategies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>策略管理</h1>
        <button class="btn btn-primary" (click)="showCreateForm()">
          ➕ 建立新策略
        </button>
      </div>

      <!-- 建立/編輯表單 -->
      <div class="form-card" *ngIf="showForm">
        <h2>{{ isEditing ? '編輯策略' : '建立策略' }}</h2>
        <form (ngSubmit)="saveStrategy()">
          <div class="form-row">
            <div class="form-group">
              <label>策略名稱 *</label>
              <input 
                type="text" 
                [(ngModel)]="currentStrategy.strategy_name" 
                name="strategy_name"
                [disabled]="isEditing"
                required
                placeholder="例如：TXF_vivi_mini">
            </div>
            <div class="form-group">
              <label>說明</label>
              <input 
                type="text" 
                [(ngModel)]="currentStrategy.description" 
                name="description"
                placeholder="策略描述">
            </div>
          </div>

          <h3>🎯 商品設定</h3>
          <div class="form-row">
            <div class="form-group">
              <label>訊號商品代碼 *</label>
              <input 
                type="text" 
                [(ngModel)]="currentStrategy.source_product" 
                name="source_product"
                required
                placeholder="TXFF5">
              <small>TradingView 訊號中的商品代碼</small>
            </div>
            <div class="form-group">
              <label>實際下單商品 *</label>
              <input 
                type="text" 
                [(ngModel)]="currentStrategy.target_product" 
                name="target_product"
                required
                placeholder="MXFF5">
              <small>實際要下單的商品代碼</small>
            </div>
          </div>

          <h3>📊 數量設定</h3>
          <div class="form-row">
            <div class="form-group">
              <label>口數倍數 *</label>
              <input 
                type="number" 
                [(ngModel)]="currentStrategy.quantity_multiplier" 
                name="quantity_multiplier"
                min="1"
                required>
              <small>訊號數量 × 此倍數 = 實際下單口數</small>
            </div>
            <div class="form-group">
              <label>最大持倉</label>
              <input 
                type="number" 
                [(ngModel)]="currentStrategy.max_position" 
                name="max_position"
                min="1">
            </div>
          </div>

          <h3>📥 進場設定</h3>
          <div class="form-row">
            <div class="form-group">
              <label>進場單別</label>
              <select [(ngModel)]="currentStrategy.entry_order_type" name="entry_order_type">
                <option value="L">限價單 (L)</option>
                <option value="M">市價單 (M)</option>
                <option value="P">範圍市價 (P)</option>
              </select>
            </div>
            <div class="form-group">
              <label>進場委託條件</label>
              <select [(ngModel)]="currentStrategy.entry_order_condition" name="entry_order_condition">
                <option value="R">ROD (R)</option>
                <option value="I">IOC (I)</option>
                <option value="F">FOK (F)</option>
              </select>
            </div>
          </div>

          <h3>📤 出場設定</h3>
          <div class="form-row">
            <div class="form-group">
              <label>出場單別</label>
              <select [(ngModel)]="currentStrategy.exit_order_type" name="exit_order_type">
                <option value="L">限價單 (L)</option>
                <option value="M">市價單 (M)</option>
                <option value="P">範圍市價 (P)</option>
              </select>
            </div>
            <div class="form-group">
              <label>出場委託條件</label>
              <select [(ngModel)]="currentStrategy.exit_order_condition" name="exit_order_condition">
                <option value="R">ROD (R)</option>
                <option value="I">IOC (I)</option>
                <option value="F">FOK (F)</option>
              </select>
            </div>
          </div>

          <h3>⚙️ 其他設定</h3>
          <div class="form-row">
            <div class="form-group">
              <label>當沖</label>
              <select [(ngModel)]="currentStrategy.dtrade" name="dtrade">
                <option value="N">否 (N)</option>
                <option value="Y">是 (Y)</option>
              </select>
            </div>
            <div class="form-group">
              <label>帳號</label>
              <input 
                type="text" 
                [(ngModel)]="currentStrategy.account" 
                name="account"
                placeholder="留空使用環境變數">
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" (click)="cancelForm()">取消</button>
            <button type="submit" class="btn btn-primary">{{ isEditing ? '更新' : '建立' }}</button>
          </div>
        </form>
      </div>

      <!-- 策略列表 -->
      <div class="strategies-grid">
        <div *ngFor="let strategy of strategies" class="strategy-card" [class.disabled]="!strategy.enabled">
          <div class="strategy-header">
            <h3>{{ strategy.strategy_name }}</h3>
            <div class="strategy-actions">
              <button 
                class="btn-icon" 
                [class.active]="strategy.enabled"
                (click)="toggleStrategy(strategy.strategy_name)"
                [title]="strategy.enabled ? '停用' : '啟用'">
                {{ strategy.enabled ? '✅' : '⭕' }}
              </button>
              <button class="btn-icon" (click)="editStrategy(strategy)" title="編輯">✏️</button>
              <button class="btn-icon danger" (click)="deleteStrategy(strategy.strategy_name)" title="刪除">🗑️</button>
            </div>
          </div>

          <div class="strategy-info">
            <div class="info-row">
              <span class="label">商品映射：</span>
              <span class="value">{{ strategy.source_product }} → {{ strategy.target_product }}</span>
            </div>
            <div class="info-row">
              <span class="label">口數倍數：</span>
              <span class="value highlight">×{{ strategy.quantity_multiplier }}</span>
            </div>
            <div class="info-row">
              <span class="label">進場：</span>
              <span class="value">{{ getOrderTypeLabel(strategy.entry_order_type) }} / {{ getConditionLabel(strategy.entry_order_condition) }}</span>
            </div>
            <div class="info-row">
              <span class="label">出場：</span>
              <span class="value">{{ getOrderTypeLabel(strategy.exit_order_type) }} / {{ getConditionLabel(strategy.exit_order_condition) }}</span>
            </div>
            <div class="info-row" *ngIf="strategy.dtrade === 'Y'">
              <span class="label">當沖：</span>
              <span class="value badge">是</span>
            </div>
            <div class="info-row" *ngIf="strategy.description">
              <span class="label">說明：</span>
              <span class="value">{{ strategy.description }}</span>
            </div>
          </div>

          <div class="strategy-footer">
            <small>建立：{{ formatDate(strategy.created_at) }}</small>
            <small *ngIf="strategy.updated_at">更新：{{ formatDate(strategy.updated_at) }}</small>
          </div>
        </div>
      </div>

      <div *ngIf="strategies.length === 0 && !loading" class="empty-state">
        <p>尚未建立任何策略</p>
        <button class="btn btn-primary" (click)="showCreateForm()">建立第一個策略</button>
      </div>

      <div *ngIf="loading" class="loading">載入中...</div>
      <div *ngIf="error" class="error">{{ error }}</div>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    .header h1 {
      margin: 0;
      font-size: 28px;
    }

    .form-card {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }

    .form-card h2 {
      margin-top: 0;
      margin-bottom: 20px;
    }

    .form-card h3 {
      margin-top: 25px;
      margin-bottom: 15px;
      font-size: 18px;
      color: #555;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 5px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    .form-group label {
      font-weight: 600;
      margin-bottom: 5px;
      color: #333;
    }

    .form-group input,
    .form-group select {
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: #4CAF50;
    }

    .form-group input:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }

    .form-group small {
      margin-top: 5px;
      color: #666;
      font-size: 12px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 30px;
    }

    .strategies-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
    }

    .strategy-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .strategy-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .strategy-card.disabled {
      opacity: 0.6;
      background: #f5f5f5;
    }

    .strategy-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e0e0e0;
    }

    .strategy-header h3 {
      margin: 0;
      font-size: 18px;
      color: #333;
    }

    .strategy-actions {
      display: flex;
      gap: 5px;
    }

    .strategy-info {
      margin-bottom: 15px;
    }

    .info-row {
      display: flex;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .info-row .label {
      font-weight: 600;
      color: #666;
      min-width: 90px;
    }

    .info-row .value {
      color: #333;
    }

    .info-row .value.highlight {
      color: #4CAF50;
      font-weight: bold;
      font-size: 16px;
    }

    .badge {
      background: #4CAF50;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }

    .strategy-footer {
      display: flex;
      justify-content: space-between;
      padding-top: 10px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #999;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: background 0.2s;
    }

    .btn-primary {
      background: #4CAF50;
      color: white;
    }

    .btn-primary:hover {
      background: #45a049;
    }

    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #d0d0d0;
    }

    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      padding: 5px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: #f0f0f0;
    }

    .btn-icon.active {
      color: #4CAF50;
    }

    .btn-icon.danger:hover {
      background: #ffebee;
      color: #f44336;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #999;
    }

    .empty-state p {
      font-size: 18px;
      margin-bottom: 20px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .error {
      background: #ffebee;
      color: #c62828;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
    }
  `]
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
      source_product: 'TXFF5',
      target_product: 'TXFF5',
      quantity_multiplier: 1,
      max_position: 10,
      order_type: 'L',
      order_condition: 'R',
      dtrade: 'N',
      entry_order_type: 'L',
      entry_order_condition: 'R',
      exit_order_type: 'M',
      exit_order_condition: 'I',
      account: '',
      sub_account: '',
      enabled: true,
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
    return new Date(date).toLocaleString('zh-TW');
  }
}
