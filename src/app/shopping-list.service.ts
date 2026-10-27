import { Injectable, computed, inject, signal } from '@angular/core';
import { FirestoreShoppingListService } from './firestore-shopping-list.service';
import { FirebaseRuntimeConfigService } from './firebase-runtime-config.service';

export interface ShoppingItem {
  id: string;
  name: string;
  /** Number of individual packages/products. */
  quantity: number;
  done: boolean;
  createdAt: number;
  category: ShoppingCategoryId;
  amountPerUnit: number | null;
  measureUnit: MeasureUnit | null;
}

export type MeasureUnit = 'kg' | 'g' | 'L' | 'ml';
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

export function normalizeMeasure(
  amountPerUnit: number | null,
  measureUnit: MeasureUnit | null,
  productCount: number,
): { weightKg: number; volumeL: number } {
  if (amountPerUnit === null || measureUnit === null) {
    return { weightKg: 0, volumeL: 0 };
  }

  const total = amountPerUnit * productCount;
  if (measureUnit === 'kg' || measureUnit === 'g') {
    return { weightKg: measureUnit === 'kg' ? total : total / 1000, volumeL: 0 };
  }
  return { weightKg: 0, volumeL: measureUnit === 'L' ? total : total / 1000 };
}

export function formatTotalMeasure(amount: number, dimension: 'weight' | 'volume'): string {
  const unit = dimension === 'weight' ? 'kg' : 'L';
  const smallUnit = dimension === 'weight' ? 'g' : 'ml';
  const converted = amount < 1 ? amount * 1000 : amount;
  const displayUnit = amount < 1 ? smallUnit : unit;
  const formatted = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(converted);
  return `${formatted} ${displayUnit}`;
}

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly firestore = inject(FirestoreShoppingListService);
  private readonly runtimeConfig = inject(FirebaseRuntimeConfigService);
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
  readonly requiresCloudSetup = computed(() => this.runtimeConfig.requiresCloud && !this.isCloudConfigured());
  readonly productCount = computed(() => this.itemState().reduce((sum, item) => sum + item.quantity, 0));
  readonly remainingCount = computed(() => this.itemState().filter((item) => !item.done).reduce((sum, item) => sum + item.quantity, 0));
  readonly completedCount = computed(() => this.itemState().filter((item) => item.done).reduce((sum, item) => sum + item.quantity, 0));
  readonly categoryStats = computed(() => {
    const items = this.itemState();
    const totalProducts = items.reduce((sum, item) => sum + item.quantity, 0);
    return SHOPPING_CATEGORIES.map((category) => {
      const categorizedItems = items.filter((item) => resolveShoppingCategory(item.category, item.name) === category.id);
      const count = categorizedItems.reduce((sum, item) => sum + item.quantity, 0);
      const completed = categorizedItems.filter((item) => item.done).reduce((sum, item) => sum + item.quantity, 0);
      const totals = categorizedItems.reduce(
        (sum, item) => {
          const itemTotal = normalizeMeasure(item.amountPerUnit, item.measureUnit, item.quantity);
          return {
            weightKg: sum.weightKg + itemTotal.weightKg,
            volumeL: sum.volumeL + itemTotal.volumeL,
          };
        },
        { weightKg: 0, volumeL: 0 },
      );
      return {
        ...category,
        count,
        completed,
        sharePercent: totalProducts === 0 ? 0 : Math.round((count / totalProducts) * 100),
        progressPercent: count === 0 ? 0 : Math.round((completed / count) * 100),
        ...totals,
      };
    }).filter((category) => category.count > 0).sort((a, b) => b.count - a.count);
  });

  constructor() {
    if (!this.isCloudConfigured()) {
      if (this.runtimeConfig.requiresCloud) {
        this.errorState.set('La sincronizzazione cloud non è configurata. Aggiungi le variabili Firebase nelle impostazioni Vercel e ridistribuisci il progetto.');
        this.loadingState.set(false);
      } else {
        this.loadLocalItems();
      }
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
        let migrationAttempted = false;
        this.unsubscribeItems = this.firestore.watchItems(
          (items) => {
            if (items.length === 0 && !migrationAttempted) {
              migrationAttempted = true;
              try {
                const localItems = this.readSavedItems();
                if (localItems.length > 0) {
                  this.loadingState.set(true);
                  void this.firestore.migrateItems(localItems).then(() => {
                    localStorage.removeItem(STORAGE_KEY);
                  }).catch((error: unknown) => {
                    this.errorState.set(this.messageFor(error));
                    this.loadingState.set(false);
                  });
                  return;
                }
              } catch (error) {
                this.errorState.set(`Impossibile trasferire la lista salvata su questo dispositivo: ${this.messageFor(error)}`);
              }
            }
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

  async addItem(
    name: string,
    quantity: number,
    category: ShoppingCategoryId,
    amountPerUnit: number | null,
    measureUnit: MeasureUnit | null,
  ): Promise<void> {
    if (this.requiresCloudSetup()) {
      this.errorState.set('La lista non è sincronizzata. Configura Firebase su Vercel prima di aggiungere prodotti.');
      return;
    }

    const item: ShoppingItem = {
      id: crypto.randomUUID(),
      name,
      quantity,
      done: false,
      createdAt: Date.now(),
      category,
      amountPerUnit,
      measureUnit,
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
    if (this.requiresCloudSetup()) {
      this.errorState.set('La lista non è sincronizzata. Configura Firebase su Vercel prima di modificarla.');
      return;
    }

    const item = this.itemState().find((entry) => entry.id === id);
    if (!item) {
      return;
    }
    const updated = { ...item, done: !item.done };
    await this.updateItem(updated);
  }

  async removeItem(id: string): Promise<void> {
    if (this.requiresCloudSetup()) {
      this.errorState.set('La lista non è sincronizzata. Configura Firebase su Vercel prima di modificarla.');
      return;
    }

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
      this.itemState.set(this.readSavedItems());
    } catch (error) {
      this.errorState.set(`Impossibile leggere la lista salvata: ${this.messageFor(error)}`);
    } finally {
      this.loadingState.set(false);
    }
  }

  private readSavedItems(): ShoppingItem[] {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return [];
    }
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      throw new Error('Il formato dei dati salvati non è valido.');
    }

    return parsed.map((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error('Un prodotto salvato non ha un formato valido.');
      }
      const data = entry as Record<string, unknown>;
      if (
        typeof data['id'] !== 'string'
        || typeof data['name'] !== 'string'
        || typeof data['quantity'] !== 'number'
        || typeof data['done'] !== 'boolean'
        || typeof data['createdAt'] !== 'number'
      ) {
        throw new Error('Un prodotto salvato non ha un formato valido.');
      }

      const amountPerUnit = data['amountPerUnit'];
      const measureUnit = data['measureUnit'];
      return {
        id: data['id'],
        name: data['name'],
        quantity: data['quantity'],
        done: data['done'],
        createdAt: data['createdAt'],
        category: resolveShoppingCategory(data['category'], data['name']),
        amountPerUnit: typeof amountPerUnit === 'number' && Number.isFinite(amountPerUnit) && amountPerUnit > 0
          ? amountPerUnit
          : null,
        measureUnit: typeof measureUnit === 'string' && ['kg', 'g', 'L', 'ml'].includes(measureUnit)
          ? measureUnit as ShoppingItem['measureUnit']
          : null,
      };
    });
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
