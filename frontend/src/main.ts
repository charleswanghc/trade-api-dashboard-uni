import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { apiBaseUrlInterceptor } from './app/services/api.service';

bootstrapApplication(AppComponent, {
  providers: [
    // 全域統一使用台灣時區 (UTC+8)，所有 date pipe 不需個別設定 timezone
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: '+0800' } },
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor]))
  ]
}).catch((err) => console.error(err));
