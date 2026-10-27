import { TestBed } from '@angular/core/testing';
import { FirestoreShoppingListService } from './firestore-shopping-list.service';
import { formatTotalMeasure, ShoppingListService } from './shopping-list.service';

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
    await shoppingList.addItem('Pane', 2, 'altro', null, null);
    const item = shoppingList.items()[0];

    expect(item.name).toBe('Pane');
    expect(item.quantity).toBe(2);
    expect(shoppingList.remainingCount()).toBe(2);

    await shoppingList.toggleItem(item.id);
    expect(shoppingList.completedCount()).toBe(2);

    await shoppingList.removeItem(item.id);
    expect(shoppingList.items()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('spesa-semplice-items') ?? '[]')).toEqual([]);
  });

  it('computes category totals, list share, and purchased progress', async () => {
    await shoppingList.addItem('Prosecco', 2, 'alcolici', 0.75, 'L');
    await shoppingList.addItem('Birra', 6, 'alcolici', 330, 'ml');
    await shoppingList.addItem('Patatine', 1, 'snack', 500, 'g');

    await shoppingList.toggleItem(shoppingList.items()[0].id);

    expect(shoppingList.categoryStats()).toEqual([
      jasmine.objectContaining({
        id: 'alcolici',
        count: 8,
        completed: 2,
        sharePercent: 89,
        progressPercent: 25,
        volumeL: 3.48,
      }),
      jasmine.objectContaining({
        id: 'snack',
        count: 1,
        completed: 0,
        sharePercent: 11,
        progressPercent: 0,
        weightKg: 0.5,
      }),
    ]);
  });

  it('formats total weights and volumes using readable Italian units', () => {
    expect(formatTotalMeasure(0.5, 'weight')).toBe('500 g');
    expect(formatTotalMeasure(1.25, 'weight')).toBe('1,25 kg');
    expect(formatTotalMeasure(0.75, 'volume')).toBe('750 ml');
    expect(formatTotalMeasure(3.48, 'volume')).toBe('3,48 L');
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
    expect(restoredList.items()[0].amountPerUnit).toBeNull();
    expect(restoredList.items()[0].measureUnit).toBeNull();
  });

  it('migrates the existing browser list when the shared Firestore list is empty', async () => {
    const savedItem = {
      id: 'existing-product',
      name: 'Birra',
      quantity: 5,
      done: false,
      createdAt: 1,
    };
    localStorage.setItem('spesa-semplice-items', JSON.stringify([savedItem]));

    let receiveItems: ((items: never[]) => void) | undefined;
    const migrateItems = jasmine.createSpy('migrateItems').and.resolveTo();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{
        provide: FirestoreShoppingListService,
        useValue: {
          isConfigured: () => true,
          watchAuth: (next: (user: { uid: string } | null) => void) => {
            next({ uid: 'personal-account' });
            return () => {};
          },
          watchItems: (next: (items: never[]) => void) => {
            receiveItems = next;
            return () => {};
          },
          migrateItems,
        },
      }],
    });

    TestBed.inject(ShoppingListService);
    receiveItems?.([]);
    await Promise.resolve();

    expect(migrateItems).toHaveBeenCalledWith([
      jasmine.objectContaining({
        id: 'existing-product',
        name: 'Birra',
        quantity: 5,
        category: 'alcolici',
        amountPerUnit: null,
        measureUnit: null,
      }),
    ]);
  });
});
