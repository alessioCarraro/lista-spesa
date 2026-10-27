import { Injectable, computed, inject, signal } from '@angular/core';
import { FirestoreShoppingListService } from './firestore-shopping-list.service';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  done: boolean;
  createdAt: number;
  category: ShoppingCategoryId;
}

export type ShoppingFilter = 'all' | 'active' | 'completed';
export type ShoppingCategoryId =
  | 'alcolici'
  | 'surgelati'
  | 'dolci'
  | 'pasta'
  | 'snack'
  | 'frutta-verdura'
  | 'latticini'
  | 'carne-pesce'
  | 'bevande'
  | 'dispensa'
  | 'altro';

export const SHOPPING_CATEGORIES: ReadonlyArray<{ id: ShoppingCategoryId; label: string; emoji: string }> = [
  { id: 'alcolici', label: 'Alcolici', emoji: '🍷' },
  { id: 'surgelati', label: 'Surgelati', emoji: '🧊' },
  { id: 'dolci', label: 'Dolci', emoji: '🍰' },
  { id: 'pasta', label: 'Pasta', emoji: '🍝' },
  { id: 'snack', label: 'Snack', emoji: '🥨' },
  { id: 'frutta-verdura', label: 'Frutta e verdura', emoji: '🥑' },
  { id: 'latticini', label: 'Latticini', emoji: '🧀' },
  { id: 'carne-pesce', label: 'Carne e pesce', emoji: '🐟' },
  { id: 'bevande', label: 'Bevande', emoji: '🥤' },
  { id: 'dispensa', label: 'Dispensa', emoji: '🫙' },
  { id: 'altro', label: 'Altro', emoji: '🛒' },
];

const STORAGE_KEY = 'spesa-semplice-items';

export function isShoppingCategoryId(value: unknown): value is ShoppingCategoryId {
  return SHOPPING_CATEGORIES.some((category) => category.id === value);
}

export function inferShoppingCategory(name: string): ShoppingCategoryId {
  const normalized = name.toLocaleLowerCase('it');
  if (/\b(vino|birra|prosecco|spumante|spritz|aperol|campari|gin|vodka|rum|whisky|whiskey|liquore|amaro|cocktail|alcol|tonica)\b/.test(normalized)) return 'alcolici';
  if (/\b(surgelat|gelato|ghiaccio)\b/.test(normalized)) return 'surgelati';
  if (/\b(dolc|cioccolat|torta|biscott|caramell|gelatin)\b/.test(normalized)) return 'dolci';
  if (/\b(pasta|spaghetti|penne|fusilli|lasagne|ravioli)\b/.test(normalized)) return 'pasta';
  if (/\b(snack|patatin|cracker|nocciolin|chips|popcorn)\b/.test(normalized)) return 'snack';
  if (/\b(frutta|verdura|pomodor|insalata|mela|banana|limon|arancia|zucchin|melanzan)\b/.test(normalized)) return 'frutta-verdura';
  if (/\b(latte|formagg|yogurt|burro|mozzarella|panna)\b/.test(normalized)) return 'latticini';
  if (/\b(carne|pollo|manzo|salsicc|pesce|tonno|salmone|prosciutto)\b/.test(normalized)) return 'carne-pesce';
  if (/\b(acqua|succo|bibita|cola|coca|limonata|bevanda)\b/.test(normalized)) return 'bevande';
  if (/\b(olio|sale|pepe|farina|riso|caff[eè]|t[eè]|conserv|passata)\b/.test(normalized)) return 'dispensa';
  return 'altro';
}

export function resolveShoppingCategory(value: unknown, name: string): ShoppingCategoryId {
  return isShoppingCategoryId(value) ? value : inferShoppingCategory(name);
}

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly firestore = inject(FirestoreShoppingListService);
  private readonly itemState = signal<ShoppingItem[]>([]);
  private readonly loadingState = signal(true);
  private readonly signedInState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private unsubscribeItems?: () => void;

  readonly items = this.itemState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly isSignedIn = this.signedInState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly isCloudConfigured = this.firestore.isConfigured;
  readonly remainingCount = computed(() => this.itemState().filter((item) => !item.done).length);
  readonly completedCount = computed(() => this.itemState().filter((item) => item.done).length);
  readonly categoryStats = computed(() => {
    const items = this.itemState();
    const total = items.length;
    return SHOPPING_CATEGORIES.map((category) => {
      const categorizedItems = items.filter((item) => resolveShoppingCategory(item.category, item.name) === category.id);
      const count = categorizedItems.length;
      const completed = categorizedItems.filter((item) => item.done).length;
      return {
        ...category,
        count,
        completed,
        sharePercent: total === 0 ? 0 : Math.round((count / total) * 100),
        progressPercent: count === 0 ? 0 : Math.round((completed / count) * 100),
      };
    }).filter((category) => category.count > 0).sort((a, b) => b.count - a.count);
  });

  constructor() {
    if (!this.isCloudConfigured()) {
      this.loadLocalItems();
      return;
    }

    this.firestore.watchAuth((user) => {
      this.unsubscribeItems?.();
      this.unsubscribeItems = undefined;
      this.signedInState.set(!!user);
      this.itemState.set([]);
      this.errorState.set(null);

      if (user) {
        this.loadingState.set(true);
        this.unsubscribeItems = this.firestore.watchItems(
          (items) => {
            this.itemState.set(items);
            this.loadingState.set(false);
          },
          (error) => {
            this.errorState.set(this.messageFor(error));
            this.loadingState.set(false);
          },
        );
      } else {
        this.loadingState.set(false);
      }
    }, (error) => {
      this.errorState.set(this.messageFor(error));
      this.loadingState.set(false);
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      await this.firestore.signIn(email, password);
    } catch (error) {
      this.errorState.set(this.messageFor(error));
      this.loadingState.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.errorState.set(null);
    try {
      await this.firestore.signOut();
    } catch (error) {
      this.errorState.set(this.messageFor(error));
    }
  }

  async addItem(name: string, quantity: number, category: ShoppingCategoryId): Promise<void> {
    const item: ShoppingItem = {
      id: crypto.randomUUID(),
      name,
      quantity,
      done: false,
      createdAt: Date.now(),
      category,
    };

    await this.persistChange(async () => {
      if (this.isCloudConfigured()) {
        await this.firestore.addItem(item);
      } else {
        this.saveLocalItems([...this.itemState(), item]);
        this.itemState.update((items) => [...items, item]);
      }
    });
  }

  async toggleItem(id: string): Promise<void> {
    const item = this.itemState().find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    const updated = { ...item, done: !item.done };
    await this.updateItem(updated);
  }

  async removeItem(id: string): Promise<void> {
    await this.persistChange(async () => {
      if (this.isCloudConfigured()) {
        await this.firestore.removeItem(id);
      } else {
        const updated = this.itemState().filter((item) => item.id !== id);
        this.saveLocalItems(updated);
        this.itemState.set(updated);
      }
    });
  }

  async clearCompleted(): Promise<void> {
    const completed = this.itemState().filter((item) => item.done);
    await Promise.all(completed.map((item) => this.removeItem(item.id)));
  }

  private async updateItem(updatedItem: ShoppingItem): Promise<void> {
    await this.persistChange(async () => {
      if (this.isCloudConfigured()) {
        await this.firestore.updateItem(updatedItem);
      } else {
        const updated = this.itemState().map((item) => item.id === updatedItem.id ? updatedItem : item);
        this.saveLocalItems(updated);
        this.itemState.set(updated);
      }
    });
  }

  private async persistChange(change: () => Promise<void>): Promise<void> {
    this.errorState.set(null);
    try {
      await change();
    } catch (error) {
      this.errorState.set(this.messageFor(error));
    }
  }

  private loadLocalItems(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
          throw new Error('Il formato dei dati salvati non è valido.');
        }
        this.itemState.set((parsed as ShoppingItem[]).map((item) => ({
          ...item,
          category: resolveShoppingCategory(item.category, item.name),
        })));
      }
    } catch (error) {
      this.errorState.set(`Impossibile leggere la lista salvata: ${this.messageFor(error)}`);
    } finally {
      this.loadingState.set(false);
    }
  }

  private saveLocalItems(items: ShoppingItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  private messageFor(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Si è verificato un errore imprevisto. Riprova.';
  }
}
