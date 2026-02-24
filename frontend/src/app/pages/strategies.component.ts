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
      padding: 0;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 22px;
    }

    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }

    .form-card {
      background: var(--panel);
      border: 1px solid var(--primary);
      border-radius: 12px;
      padding: 22px;
      box-shadow: 0 0 22px var(--primary-glow);
      margin-bottom: 22px;
    }

    .form-card h2 {
      margin-top: 0;
      margin-bottom: 18px;
      font-size: 16px;
      font-weight: 700;
    }

    .form-card h3 {
      margin-top: 18px;
      margin-bottom: 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    .form-group label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 5px;
      color: var(--muted);
    }

    .form-group input,
    .form-group select {
      padding: 9px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      background: var(--panel-2);
      color: var(--text);
      transition: border-color 0.15s;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }

    .form-group input:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .form-group small {
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }

    .strategies-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 14px;
    }

    .strategy-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .strategy-card:hover {
      border-color: rgba(34, 211, 238, 0.3);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }

    .strategy-card.disabled {
      opacity: 0.5;
    }

    .strategy-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }

    .strategy-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      text-transform: none;
      letter-spacing: normal;
      border: none;
      padding: 0;
    }

    .strategy-actions {
      display: flex;
      gap: 4px;
    }

    .strategy-info {
      margin-bottom: 12px;
    }

    .info-row {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
      font-size: 13px;
    }

    .info-row .label {
      font-size: 11px;
      color: var(--muted);
      min-width: 80px;
    }

    .info-row .value {
      color: var(--text);
    }

    .info-row .value.highlight {
      color: var(--primary);
      font-weight: 700;
      font-size: 15px;
    }

    .badge {
      background: rgba(52, 211, 153, 0.14);
      color: var(--success);
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }

    .strategy-footer {
      display: flex;
      justify-content: space-between;
      padding-top: 10px;
      border-top: 1px solid var(--border);
      font-size: 11px;
      color: var(--muted);
    }

    .btn {
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      transition: opacity 0.15s;
    }

    .btn-primary {
      background: var(--primary);
      color: #0d1117;
    }

    .btn-primary:hover { opacity: 0.85; }

    .btn-secondary {
      background: var(--panel-2);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover { opacity: 0.85; }

    .btn-icon {
      background: none;
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 14px;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.15s;
    }

    .btn-icon:hover {
      background: var(--panel-2);
    }

    .btn-icon.active {
      color: var(--success);
      border-color: rgba(52, 211, 153, 0.3);
    }

    .btn-icon.danger:hover {
      background: rgba(248, 113, 113, 0.12);
      border-color: rgba(248, 113, 113, 0.3);
    }

    .empty-state {
      text-align: center;
      padding: 56px 20px;
      color: var(--muted);
    }

    .empty-state p {
      font-size: 15px;
      margin-bottom: 18px;
      color: var(--muted);
    }

    .loading {
      text-align: center;
      padding: 36px;
      color: var(--muted);
    }

    .error {
      background: rgba(248, 113, 113, 0.08);
      color: var(--danger);
      border: 1px solid rgba(248, 113, 113, 0.25);
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 14px;
      font-size: 13px;
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
