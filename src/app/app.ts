import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SHOPPING_CATEGORIES,
  type ShoppingCategoryId,
  type ShoppingFilter,
  ShoppingListService,
} from './shopping-list.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly shoppingList = inject(ShoppingListService);
  protected readonly categories = SHOPPING_CATEGORIES;
  protected readonly filter = signal<ShoppingFilter>('all');
  protected selectedCategory: ShoppingCategoryId = 'altro';
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
  protected email = '';
  protected password = '';

  protected async addItem(): Promise<void> {
    const name = this.itemName.trim();
    if (!name || !Number.isInteger(this.quantity) || this.quantity < 1) {
      return;
    }

    await this.shoppingList.addItem(name, this.quantity, this.selectedCategory);
    if (!this.shoppingList.error()) {
      this.itemName = '';
      this.quantity = 1;
      this.selectedCategory = 'altro';
    }
  }

  protected async signIn(): Promise<void> {
    await this.shoppingList.signIn(this.email.trim(), this.password);
    if (this.shoppingList.isSignedIn()) {
      this.password = '';
    }
  }
}
