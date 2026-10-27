import { TestBed } from '@angular/core/testing';
import { FirestoreShoppingListService } from './firestore-shopping-list.service';
import { ShoppingListService } from './shopping-list.service';

describe('ShoppingListService', () => {
  let shoppingList: ShoppingListService;

  beforeEach(() => {
    localStorage.removeItem('spesa-semplice-items');
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FirestoreShoppingListService,
          useValue: { isConfigured: () => false },
        },
      ],
    });
    shoppingList = TestBed.inject(ShoppingListService);
  });

  afterEach(() => localStorage.removeItem('spesa-semplice-items'));

  it('adds, completes, and removes items while keeping computed counts in sync', async () => {
    await shoppingList.addItem('Pane', 2, 'altro');
    const item = shoppingList.items()[0];

    expect(item.name).toBe('Pane');
    expect(item.quantity).toBe(2);
    expect(shoppingList.remainingCount()).toBe(1);

    await shoppingList.toggleItem(item.id);
    expect(shoppingList.completedCount()).toBe(1);

    await shoppingList.removeItem(item.id);
    expect(shoppingList.items()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('spesa-semplice-items') ?? '[]')).toEqual([]);
  });

  it('computes category totals, list share, and purchased progress', async () => {
    await shoppingList.addItem('Prosecco', 2, 'alcolici');
    await shoppingList.addItem('Birra', 6, 'alcolici');
    await shoppingList.addItem('Patatine', 1, 'snack');

    await shoppingList.toggleItem(shoppingList.items()[0].id);

    expect(shoppingList.categoryStats()).toEqual([
      jasmine.objectContaining({
        id: 'alcolici',
        count: 2,
        completed: 1,
        sharePercent: 67,
        progressPercent: 50,
      }),
      jasmine.objectContaining({
        id: 'snack',
        count: 1,
        completed: 0,
        sharePercent: 33,
        progressPercent: 0,
      }),
    ]);
  });

  it('infers a category for items saved before categories were added', () => {
    localStorage.setItem('spesa-semplice-items', JSON.stringify([
      { id: 'old-item', name: 'Birra', quantity: 6, done: false, createdAt: 1 },
    ]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{
        provide: FirestoreShoppingListService,
        useValue: { isConfigured: () => false },
      }],
    });

    const restoredList = TestBed.inject(ShoppingListService);

    expect(restoredList.items()[0].category).toBe('alcolici');
  });
});
