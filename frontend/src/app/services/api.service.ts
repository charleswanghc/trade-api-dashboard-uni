import { HttpClient, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  health() {
    return this.http.get<Record<string, unknown>>('/health');
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
}
