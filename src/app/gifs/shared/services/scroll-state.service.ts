import { Injectable, signal } from '@angular/core';

@Injectable({providedIn: 'root'})
export class ScrollSrareService {
  trendingScrollState = signal (0);

}
