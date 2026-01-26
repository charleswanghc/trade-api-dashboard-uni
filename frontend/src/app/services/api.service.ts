import { HttpClient, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const DEFAULT_API_BASE = 'http://localhost:9879';

const getApiBaseUrl = (): string => {
  const custom = (window as any).__API_BASE_URL__ as string | undefined;
  return custom || DEFAULT_API_BASE;
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
}
