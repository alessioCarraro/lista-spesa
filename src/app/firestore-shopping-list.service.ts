import { inject, Injectable } from '@angular/core';
import {
  Auth,
  User,
} from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { FirebaseRuntimeConfigService } from './firebase-runtime-config.service';
import { resolveShoppingCategory, type ShoppingItem } from './shopping-list.service';

type FirebaseClients = { auth: Auth; database: Firestore };

@Injectable({ providedIn: 'root' })
export class FirestoreShoppingListService {
  private readonly runtimeConfig = inject(FirebaseRuntimeConfigService);
  private clients?: Promise<FirebaseClients>;

  readonly isConfigured = this.runtimeConfig.isConfigured;

  watchAuth(next: (user: User | null) => void, error: (error: Error) => void): () => void {
    let cancelled = false;
    let unsubscribe = () => {};
    void this.getClients()
      .then(async ({ auth }) => {
        const { onAuthStateChanged } = await import('firebase/auth');
        if (!cancelled) {
          unsubscribe = onAuthStateChanged(auth, next, error);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          error(this.asError(reason));
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  async signIn(email: string, password: string): Promise<void> {
    const [{ auth }, { signInWithEmailAndPassword }] = await Promise.all([
      this.getClients(),
      import('firebase/auth'),
    ]);
    await signInWithEmailAndPassword(auth, email, password);
  }

  async signOut(): Promise<void> {
    const [{ auth }, { signOut }] = await Promise.all([this.getClients(), import('firebase/auth')]);
    await signOut(auth);
  }

  watchItems(next: (items: ShoppingItem[]) => void, error: (error: Error) => void): () => void {
    let cancelled = false;
    let unsubscribe = () => {};
    void Promise.all([this.getClients(), import('firebase/firestore')])
      .then(([{ database }, firestore]) => {
        const itemsQuery = firestore.query(
          firestore.collection(database, 'shopping-items'),
          firestore.orderBy('createdAt', 'asc'),
        );
        if (!cancelled) {
          unsubscribe = firestore.onSnapshot(itemsQuery, (snapshot) => {
            next(snapshot.docs.map((itemDocument) => {
              const data = itemDocument.data();
              return {
                id: itemDocument.id,
                name: data['name'] as string,
                quantity: data['quantity'] as number,
                done: data['done'] as boolean,
                createdAt: data['createdAt'] as number,
                category: resolveShoppingCategory(data['category'], data['name'] as string),
                amountPerUnit: typeof data['amountPerUnit'] === 'number' && data['amountPerUnit'] > 0
                  ? data['amountPerUnit']
                  : null,
                measureUnit: ['kg', 'g', 'L', 'ml'].includes(data['measureUnit'] as string)
                  ? data['measureUnit'] as ShoppingItem['measureUnit']
                  : null,
              };
            }));
          }, error);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          error(this.asError(reason));
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }

  async addItem(item: ShoppingItem): Promise<void> {
    const [{ database }, firestore] = await Promise.all([
      this.getClients(),
      import('firebase/firestore'),
    ]);
    const { id: _id, ...data } = item;
    await firestore.addDoc(firestore.collection(database, 'shopping-items'), data);
  }

  async migrateItems(items: ShoppingItem[]): Promise<void> {
    const [{ database }, firestore] = await Promise.all([
      this.getClients(),
      import('firebase/firestore'),
    ]);
    const batch = firestore.writeBatch(database);
    for (const item of items) {
      const { id, ...data } = item;
      batch.set(firestore.doc(database, 'shopping-items', id), data);
    }
    await batch.commit();
  }

  async updateItem(item: ShoppingItem): Promise<void> {
    const [{ database }, firestore] = await Promise.all([
      this.getClients(),
      import('firebase/firestore'),
    ]);
    const { id, ...data } = item;
    await firestore.updateDoc(firestore.doc(database, 'shopping-items', id), data);
  }

  async removeItem(id: string): Promise<void> {
    const [{ database }, firestore] = await Promise.all([
      this.getClients(),
      import('firebase/firestore'),
    ]);
    await firestore.deleteDoc(firestore.doc(database, 'shopping-items', id));
  }

  private getClients(): Promise<FirebaseClients> {
    const config = this.runtimeConfig.config();
    if (!config) {
      return Promise.reject(new Error('Firebase non è configurato.'));
    }
    this.clients ??= Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]).then(([appSdk, authSdk, firestoreSdk]) => {
      const app = appSdk.initializeApp(config);
      return {
        auth: authSdk.getAuth(app),
        database: firestoreSdk.getFirestore(app),
      };
    });
    return this.clients;
  }

  private asError(reason: unknown): Error {
    if (reason instanceof Error) {
      return reason;
    }
    return new Error('Errore durante la connessione a Firebase.');
  }
}
