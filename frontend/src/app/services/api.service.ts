import { HttpClient, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

const getApiBaseUrl = (): string => {
  const custom = (window as any).__API_BASE_URL__ as string | undefined;
  return custom || environment.apiUrl;
};

export const apiBaseUrlInterceptor = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  if (req.url.startsWith('http')) {
    return next(req);
  }
  const baseUrl = getApiBaseUrl();
  const apiReq = req.clone({ url: `${baseUrl}${req.url}` });
  return next(apiReq);
};

export interface OrderRequest {
  actno?: string;
  subactno?: string;
  productid: string;
  bs: 'B' | 'S';
  ordertype?: 'L' | 'M' | 'P';
  price?: number;
  orderqty: number;
  ordercondition?: 'I' | 'R' | 'F';
  opencloseflag?: '0' | '1' | '';
  dtrade?: 'Y' | 'N';
  note?: string;
  strategy?: string;
}

export interface StrategyConfig {
  id?: number;
  strategy_name: string;
  source_product: string;
  target_product: string;
  quantity_multiplier: number;
  max_position: number;
  order_type: 'L' | 'M' | 'P';
  order_condition: 'I' | 'R' | 'F';
  dtrade: 'Y' | 'N';
  entry_order_type: 'L' | 'M' | 'P';
  entry_order_condition: 'I' | 'R' | 'F';
  exit_order_type: 'L' | 'M' | 'P';
  exit_order_condition: 'I' | 'R' | 'F';
  account?: string;
  sub_account: string;
  enabled: boolean;
  auto_rollover: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SignalRequest {
  strategy: string;
  signal: 'long_entry' | 'long_exit' | 'short_entry' | 'short_exit';
  quantity?: number;
  price?: number;
  product?: string;
  note?: string;
}

export interface SignalHistory {
  id: number;
  strategy_name: string;
  signal_type: string;
  signal_product?: string;
  signal_quantity?: number;
  signal_price?: number;
  signal_note?: string;
  actual_product?: string;
  actual_quantity?: number;
  actual_bs?: string;
  status: string;
  order_id?: string;
  error_message?: string;
  raw_payload?: any;
  created_at: string;
}

export interface TradeRecord {
  id: number;
  seq?: string;
  network_id?: string;
  orderno?: string;
  account?: string;
  sub_account?: string;
  product_kind?: string;
  product_id?: string;
  bs?: string;
  match_price?: number;
  match_qty?: number;
  match_seq?: string;
  match_time?: string;
  note?: string;
  mdate?: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  health() {
    return this.http.get<Record<string, unknown>>('/health').pipe(timeout(5000));
  }

  healthUnitrade() {
    return this.http.get<Record<string, unknown>>('/health/unitrade').pipe(timeout(10000));
  }

  listOrders() {
    return this.http.get<any[]>('/orders');
  }

  placeOrder(payload: OrderRequest) {
    return this.http.post<Record<string, unknown>>('/order', payload);
  }

  // ========== Strategy Management ==========
  getStrategies(enabledOnly = false) {
    const params = enabledOnly ? { enabled_only: 'true' } : {};
    return this.http.get<StrategyConfig[]>('/strategies', { params });
  }

  getStrategy(name: string) {
    return this.http.get<StrategyConfig>(`/strategies/${name}`);
  }

  createStrategy(config: StrategyConfig) {
    return this.http.post<StrategyConfig>('/strategies', config);
  }

  updateStrategy(name: string, config: StrategyConfig) {
    return this.http.put<StrategyConfig>(`/strategies/${name}`, config);
  }

  deleteStrategy(name: string) {
    return this.http.delete(`/strategies/${name}`);
  }

  toggleStrategy(name: string) {
    return this.http.patch<StrategyConfig>(`/strategies/${name}/toggle`, {});
  }

  // ========== Signal History ==========
  getSignals(limit = 100, offset = 0, strategy?: string) {
    let params: any = { limit: limit.toString(), offset: offset.toString() };
    if (strategy) {
      params.strategy = strategy;
    }
    return this.http.get<SignalHistory[]>('/signals', { params });
  }

  getSignal(id: number) {
    return this.http.get<SignalHistory>(`/signals/${id}`);
  }

  // ========== Send Signal ==========
  sendSignal(signal: SignalRequest) {
    return this.http.post<any>('/signal', signal);
  }

  // ========== Trade Records ==========
  getTrades(limit = 100, offset = 0, productId?: string) {
    let params: any = { limit: limit.toString(), offset: offset.toString() };
    if (productId) params.product_id = productId;
    return this.http.get<TradeRecord[]>('/trades', { params });
  }

  getOrderReplies(limit = 100, offset = 0) {
    const params = { limit: limit.toString(), offset: offset.toString() };
    return this.http.get<any[]>('/order-replies', { params });
  }

  triggerHistorySync() {
    return this.http.post<{ status: string; message: string }>('/history-sync', {});
  }

  // ========== Margin ==========
  getMargin() {
    return this.http.get<Margin[]>('/margin');
  }

  // ========== Positions ==========
  getPositions() {
    return this.http.get<Position[]>('/positions');
  }

  getUnliquidations() {
    return this.http.get<Unliquidation[]>('/unliquidations');
  }

  // ========== Product Lookup ==========
  getProductLookupTw() {
    return this.http.get<any[]>('/product-lookup/tw');
  }

  getProductLookupForeign() {
    return this.http.get<any[]>('/product-lookup/foreign');
  }
}

export interface Margin {
  actno?: string;
  account_date?: string;
  currency?: string;
  equity?: number;
  yesterday_equity?: number;
  yesterday_balance?: number;
  deposit_withdrawal?: number;
  original_margin?: number;
  maintenance_margin?: number;
  available_margin?: number;
  order_margin?: number;
  futures_close_pnl?: number;
  futures_float_pnl?: number;
  option_close_pnl?: number;
  option_float_pnl?: number;
  commission?: number;
  tax?: number;
  risk_rate?: number;
  initial_rate?: number;
  maintenance_rate?: number;
  liquidation_ratio?: number;
  night_equity?: number;
  night_risk_rate?: number;
  update_date?: string;
  update_time?: string;
}

export interface Position {
  product?: string;
  product_id?: string;
  product_name?: string;
  product_kind?: string;
  month?: string;
  call_put?: string;
  strike_price?: number;
  buy_open_qty?: number;
  sell_open_qty?: number;
  ot_qty_b?: number;
  ot_qty_s?: number;
  today_match_b?: number;
  today_match_s?: number;
  today_close?: number;
  buy_avg_cost?: number;
  sell_avg_cost?: number;
  ref_price?: number;
  floating_pnl?: number;
  close_pnl?: number;
}

export interface Unliquidation {
  product_id?: string;
  product_name?: string;
  bs?: string;
  total_qty?: number;
  avg_match_price?: number;
  real_price?: number;
  floating_pnl?: number;
  net_pnl?: number;
  tax?: number;
  commission?: number;
  multiname?: string;
}
