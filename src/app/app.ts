import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideApple,
  LucideCakeSlice,
  LucideCupSoda,
  LucideDynamicIcon,
  LucideFish,
  LucideMilk,
  LucidePackage,
  LucidePopcorn,
  LucideShoppingBasket,
  LucideSnowflake,
  LucideUtensils,
  LucideWine,
  type LucideIconData,
} from '@lucide/angular';
import {
  formatTotalMeasure,
  normalizeMeasure,
  SHOPPING_CATEGORIES,
  type ShoppingCategoryId,
  type ShoppingFilter,
  type MeasureUnit,
  type ShoppingItem,
  ShoppingListService,
} from './shopping-list.service';

const CATEGORY_ICONS = {
  alcolici: LucideWine.icon,
  surgelati: LucideSnowflake.icon,
  dolci: LucideCakeSlice.icon,
  pasta: LucideUtensils.icon,
  snack: LucidePopcorn.icon,
  'frutta-verdura': LucideApple.icon,
  latticini: LucideMilk.icon,
  'carne-pesce': LucideFish.icon,
  bevande: LucideCupSoda.icon,
  dispensa: LucidePackage.icon,
  altro: LucideShoppingBasket.icon,
} satisfies Record<ShoppingCategoryId, LucideIconData>;

const CATEGORY_TONES: Record<ShoppingCategoryId, string> = {
  alcolici: 'bg-rose-50 text-rose-700',
  surgelati: 'bg-sky-50 text-sky-700',
  dolci: 'bg-pink-50 text-pink-700',
  pasta: 'bg-amber-50 text-amber-700',
  snack: 'bg-orange-50 text-orange-700',
  'frutta-verdura': 'bg-lime-50 text-lime-700',
  latticini: 'bg-yellow-50 text-yellow-700',
  'carne-pesce': 'bg-cyan-50 text-cyan-700',
  bevande: 'bg-blue-50 text-blue-700',
  dispensa: 'bg-violet-50 text-violet-700',
  altro: 'bg-emerald-50 text-emerald-700',
};

@Component({
  selector: 'app-root',
  imports: [FormsModule, NgClass, LucideDynamicIcon],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly shoppingList = inject(ShoppingListService);
  protected readonly categories = SHOPPING_CATEGORIES;
  protected readonly categoryIcons = CATEGORY_ICONS;
  protected readonly filter = signal<ShoppingFilter>('all');
  protected selectedCategory: ShoppingCategoryId = 'altro';
  protected measureUnit: MeasureUnit = 'L';
  protected readonly visibleItems = computed(() => {
    const items = this.shoppingList.items();
    switch (this.filter()) {
      case 'active':
        return items.filter((item) => !item.done);
      case 'completed':
        return items.filter((item) => item.done);
      default:
        return items;
    }
  });

  protected itemName = '';
  protected quantity = 1;
  protected amountPerUnit: number | null = null;
  protected email = '';
  protected password = '';

  protected async addItem(): Promise<void> {
    const name = this.itemName.trim();
    if (
      !name
      || !Number.isInteger(this.quantity)
      || this.quantity < 1
      || (this.amountPerUnit !== null && (!Number.isFinite(this.amountPerUnit) || this.amountPerUnit <= 0))
    ) {
      return;
    }

    await this.shoppingList.addItem(
      name,
      this.quantity,
      this.selectedCategory,
      this.amountPerUnit,
      this.amountPerUnit === null ? null : this.measureUnit,
    );
    if (!this.shoppingList.error()) {
      this.itemName = '';
      this.quantity = 1;
      this.amountPerUnit = null;
      this.measureUnit = 'L';
      this.selectedCategory = 'altro';
    }
  }

  protected categoryName(category: ShoppingCategoryId): string {
    return this.categories.find((entry) => entry.id === category)?.label ?? 'Altro';
  }

  protected categoryTone(category: ShoppingCategoryId): string {
    return CATEGORY_TONES[category];
  }

  protected formatMeasure(amount: number, dimension: 'weight' | 'volume'): string {
    return formatTotalMeasure(amount, dimension);
  }

  protected itemMeasurement(item: ShoppingItem): string {
    if (item.amountPerUnit === null || item.measureUnit === null) {
      return `${item.quantity} ${item.quantity === 1 ? 'prodotto' : 'prodotti'}`;
    }

    const amount = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(item.amountPerUnit);
    const dimension = item.measureUnit === 'kg' || item.measureUnit === 'g' ? 'weight' : 'volume';
    const total = normalizeMeasure(item.amountPerUnit, item.measureUnit, item.quantity);
    const normalizedTotal = formatTotalMeasure(dimension === 'weight' ? total.weightKg : total.volumeL, dimension);

    return `${item.quantity} × ${amount} ${item.measureUnit} · ${normalizedTotal} totali`;
  }

  protected async signIn(): Promise<void> {
    await this.shoppingList.signIn(this.email.trim(), this.password);
    if (this.shoppingList.isSignedIn()) {
      this.password = '';
    }
  }
}
