import { Component, inject, signal } from '@angular/core';
import { GifList } from '../../components/gif-list/gif-list';
import { GifService, GIF_SEARCH_PAGE_SIZE } from '../../services/gifs.service';
import { Gif } from '../../interfaces/gif.interface';
import { Subscription } from 'rxjs';

const MAX_GIPHY_OFFSET = 5000;

@Component({
  selector: 'app-search-page',
  imports: [GifList],
  templateUrl: './search-page.html',
})
export default class SearchPage {

  gifService = inject(GifService);
  gifs = signal<Gif[]>([]);
  searchError = signal<string | null>(null);
  isLoading = signal(false);
  hasMore = signal(false);

  private currentQuery = '';
  private nextOffset = 0;
  private totalCount = 0;
  private activeSearch: Subscription | null = null;

  onSearch(query: string) {
    const trimmedQuery = query.trim();
    this.activeSearch?.unsubscribe();
    this.isLoading.set(false);
    this.searchError.set(null);
    this.currentQuery = trimmedQuery.toLowerCase();
    this.nextOffset = 0;
    this.totalCount = 0;
    this.hasMore.set(false);

    if (!trimmedQuery) {
      this.gifs.set([]);
      this.isLoading.set(false);
      return;
    }

    this.gifs.set([]);
    this.loadSearchPage(trimmedQuery, 0);
  }

  onScroll(event: Event) {
    const scrollElement = event.currentTarget;
    if (!(scrollElement instanceof HTMLElement)) return;

    const isNearBottom = scrollElement.scrollTop + scrollElement.clientHeight + 300
      >= scrollElement.scrollHeight;

    if (isNearBottom) {
      this.loadMore();
    }
  }

  retryLoading(): void {
    this.searchError.set(null);
    this.loadSearchPage(this.currentQuery, this.nextOffset);
  }

  private loadMore(): void {
    if (this.isLoading() || !this.hasMore()) return;
    this.loadSearchPage(this.currentQuery, this.nextOffset);
  }

  private loadSearchPage(query: string, offset: number): void {
    if (this.isLoading()) return;

    this.isLoading.set(true);
    this.activeSearch = this.gifService.searchGifs(query, offset).subscribe({
      next: ({gifs, totalCount}) => {
        if (this.currentQuery !== query.trim().toLowerCase()) return;

        this.gifs.update(currentGifs => offset === 0 ? gifs : [...currentGifs, ...gifs]);
        this.totalCount = totalCount;
        this.nextOffset = offset + gifs.length;
        this.hasMore.set(
          gifs.length > 0
          && this.nextOffset < Math.min(this.totalCount, MAX_GIPHY_OFFSET)
          && gifs.length === GIF_SEARCH_PAGE_SIZE
        );
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        if (this.currentQuery !== query.trim().toLowerCase()) return;

        this.searchError.set(this.gifService.getApiErrorMessage(error));
        this.isLoading.set(false);
      },
    });
  }
}
