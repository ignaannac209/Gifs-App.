import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { environment } from '@environments/environment';

import { Gif } from '../interfaces/gif.interface';
import { GifMapper } from '../mapper/gif.mapper';
import { GiphyResponse } from '../interfaces/giphy.interface';
import { map, Observable, tap } from 'rxjs';


const GIF_KEY = 'gifs';

const isGif = (value: unknown): value is Gif => {
  if (!value || typeof value !== 'object') return false;
  const gif = value as Record<string, unknown>;
  return typeof gif['id'] === 'string'
    && typeof gif['title'] === 'string'
    && typeof gif['url'] === 'string';
};

const loadFromLocalStorage = (): Record<string, Gif[]> => {
  if (typeof localStorage === 'undefined') return {};

  try {
    const storedGifs: unknown = JSON.parse(localStorage.getItem(GIF_KEY) ?? '{}');
    if (storedGifs && typeof storedGifs === 'object' && !Array.isArray(storedGifs)) {
      const history: Record<string, Gif[]> = {};
      for (const [query, gifs] of Object.entries(storedGifs)) {
        if (Array.isArray(gifs) && gifs.every(isGif)) {
          history[query] = gifs;
        }
      }
      return history;
    }
  } catch (error) {
    console.warn('No se pudo leer el historial de GIFs guardado.', error);
  }

  return {};
};

@Injectable({ providedIn: 'root' })
export class GifService {
    private http = inject(HttpClient);

    trendingGifs = signal<Gif[]>([]); //[gif, gif, gif, gif, gif,]
    trendingGifsLoading = signal(false);
    trendingGifsError = signal<string | null>(null);
    private trendingPage = signal(0);

    // [[gif, gif, gif], [gif, gif, gif], ...]
    trendingGifGroup = computed<Gif[][]>(() => {
        const groups: Gif[][] = [];
        const gifs = this.trendingGifs();

        for (let i = 0; i < gifs.length; i += 3) {
            groups.push(gifs.slice(i, i + 3));
        }

        return groups;
    });

    searchHistory = signal<Record<string, Gif[]>>(loadFromLocalStorage());
    searchHistoryKeys = computed(() => Object.keys(this.searchHistory()));


    constructor() {
        this.loadTrendingGifs();
    }

      saveGifsToLocalStorage = effect (() => {
        const historyString = JSON.stringify(this.searchHistory());
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(GIF_KEY, historyString);
        }
      })

    loadTrendingGifs() {

      if (this.trendingGifsLoading()) return;

      this.trendingGifsLoading.set(true);
      this.trendingGifsError.set(null);

        this.http
            .get<GiphyResponse>(`${environment.giphyUrl}/gifs/trending`, {
                params: {
                    api_key: environment.giphyApiKey,
                    limit: 20,
                    offset: this.trendingPage() * 20,
                },
            })
            .subscribe({
              next: (resp) => {
                const gifs = GifMapper.mapGiphyItemsToGifArray(resp.data);
                this.trendingGifs.update((currentGifs) => [...currentGifs, ...gifs]);
                this.trendingPage.update((page) => page + 1);
                this.trendingGifsLoading.set(false);
              },
              error: (error: unknown) => {
                this.trendingGifsError.set(this.getApiErrorMessage(error));
                this.trendingGifsLoading.set(false);
              },
            });
    }

    searchGifs(query: string):Observable<Gif[]> {
      const normalizedQuery = query.trim().toLowerCase();

      return this.http
            .get<GiphyResponse>(`${environment.giphyUrl}/gifs/search`, {
                params: {
                    api_key: environment.giphyApiKey,
                    limit: 20,
                    q: query.trim(),
                },
            }).pipe(
              map(({data}) => data ),
             map((items) => GifMapper.mapGiphyItemsToGifArray(items)),
             tap( items => {
              this.searchHistory.update( history => ({
                ...history,
                [normalizedQuery]: items
              }))
             })
            );
    }

    getHistoryGifs(query: string): Gif[] {
      return this.searchHistory()[query.trim().toLowerCase()] ?? [];
    }

    removeSearchFromHistory(query: string): void {
      const normalizedQuery = query.trim().toLowerCase();
      this.searchHistory.update(history => {
        const updatedHistory = { ...history };
        delete updatedHistory[normalizedQuery];
        return updatedHistory;
      });
    }

    getApiErrorMessage(error: unknown): string {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          return 'No se pudo conectar con Giphy. Revisa tu conexión a internet.';
        }

        const apiMessage = error.error?.meta?.msg;
        if (typeof apiMessage === 'string') {
          return `Giphy respondió con un error (${error.status}): ${apiMessage}`;
        }

        return `Giphy respondió con un error (${error.status}). Revisa que la clave de API sea válida.`;
      }

      return 'Ocurrió un error inesperado al cargar los GIFs.';
    }
}
