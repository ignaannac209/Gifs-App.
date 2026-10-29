import { Component, inject, signal } from '@angular/core';
import { GifList } from '../../components/gif-list/gif-list';
import { GifService } from '../../services/gifs.service';
import { Gif } from '../../interfaces/gif.interface';

@Component({
  selector: 'app-search-page',
  imports: [GifList],
  templateUrl: './search-page.html',
})
export default class SearchPage {

  gifService = inject(GifService);
  gifs = signal<Gif[]>([]);
  searchError = signal<string | null>(null);

  onSearch(query: string) {
    const trimmedQuery = query.trim();
    this.searchError.set(null);

    if (!trimmedQuery) {
      this.gifs.set([]);
      return;
    }

    this.gifService.searchGifs(trimmedQuery).subscribe({
      next: (gifs) => this.gifs.set(gifs),
      error: (error: unknown) => {
        this.searchError.set(this.gifService.getApiErrorMessage(error));
        this.gifs.set([]);
      },
    });
  }
}
