# Spesa semplice

Applicazione responsive per gestire una lista della spesa con Angular, TypeScript, Signals, Tailwind CSS e Firebase Firestore.

Ogni articolo può essere assegnato a una categoria. Le statistiche mostrano il numero di articoli per categoria, la quota percentuale sul totale e l'avanzamento degli acquisti; per le liste già salvate, la categoria viene dedotta dal nome quando possibile.

La quantità indica il numero di singoli prodotti/confezioni; il peso o volume per confezione è facoltativo. I totali di categoria sommano automaticamente grammi in kg e ml in litri, mantenendo separati peso e volume. Ad esempio, 3 bottiglie da 0,75 L vengono conteggiate come 3 prodotti e 2,25 L.

## Avvio in locale

```bash
npm install
npm start
```

Senza una configurazione Firebase, la lista funziona subito e viene salvata nel `localStorage` del browser. Questa modalità non sincronizza i dati tra browser o dispositivi.

## Attivare la sincronizzazione cloud

1. Crea un progetto nel [Firebase Console](https://console.firebase.google.com/) e aggiungi una Web App.
2. Abilita **Authentication → Sign-in method → Email/Password**.
3. In **Authentication → Users**, crea un solo utente personale. Non abilitare la registrazione pubblica: riutilizza questo account sui tuoi dispositivi.
4. Crea un database **Cloud Firestore**.
5. In Vercel, apri **Project → Settings → Environment Variables** e aggiungi i valori della configurazione Firebase della Web App:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_APP_ID`
6. Assicurati che le variabili siano abilitate per **Production** (e Preview, se serve) e ridistribuisci il progetto. La Function `api/firebase-config.js` le fornisce all'app come configurazione Firebase Web pubblica: non mettere password o chiavi di servizio in queste variabili.
7. In Firestore Rules, sostituisci `replace-with-your-email@example.com` in `firestore.rules` con l'indirizzo dell'account e pubblica le regole.
8. Apri il deploy Vercel aggiornato e accedi con lo stesso account da ogni dispositivo.

Le regole limitano lettura e scrittura all'utente autenticato con l'indirizzo specificato. Le credenziali Firebase della Web App non sono segreti: è l'autenticazione insieme alle regole Firestore a proteggere i dati. Non committare password dell'account.

Il deploy di produzione non usa il salvataggio locale come ripiego: se le variabili Firebase mancano, mostra un messaggio di configurazione e non accetta modifiche, per evitare liste diverse e apparentemente salvate su ciascun dispositivo. In sviluppo locale senza Firebase, `localStorage` resta disponibile per provare l'interfaccia. Al primo accesso cloud, se Firestore è ancora vuoto, gli articoli salvati localmente su quel browser vengono trasferiti automaticamente alla lista condivisa.

## Struttura

- `src/app/app.ts` e `src/app/app.html`: vista e interazioni dell'interfaccia.
- `src/app/shopping-list.service.ts`: stato applicativo con `signal` e valori derivati con `computed`.
- `src/app/firestore-shopping-list.service.ts`: autenticazione e operazioni realtime su Firestore.
- `api/firebase-config.js`: endpoint serverless Vercel che espone solo la configurazione pubblica della Web App.
- `src/app/firebase-runtime-config.service.ts`: carica la configurazione cloud prima di avviare l'app.
- `src/environments/environment.ts`: fallback Firebase per lo sviluppo locale.
- `firestore.rules`: accesso al database riservato all'account personale.

## Comandi

```bash
npm start
npm run build
npm test
```
