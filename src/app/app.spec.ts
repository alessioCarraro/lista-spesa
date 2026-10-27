import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { ShoppingListService } from './shopping-list.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: ShoppingListService,
          useValue: {
            items: () => [],
            isLoading: () => false,
            isSignedIn: () => false,
            isCloudConfigured: () => false,
            requiresCloudSetup: () => false,
            error: () => null,
            remainingCount: () => 0,
            completedCount: () => 0,
            productCount: () => 0,
            categoryStats: () => [],
            addItem: jasmine.createSpy('addItem'),
            toggleItem: jasmine.createSpy('toggleItem'),
            removeItem: jasmine.createSpy('removeItem'),
            clearCompleted: jasmine.createSpy('clearCompleted'),
            signIn: jasmine.createSpy('signIn'),
            signOut: jasmine.createSpy('signOut'),
          },
        },
      ],
    }).compileComponents();
  });

  it('creates the shopping list view', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Cosa ci serve?');
  });
});
