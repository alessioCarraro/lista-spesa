# Spesa semplice

Applicazione responsive per gestire una lista della spesa con Angular, TypeScript, Signals, Tailwind CSS e Firebase Firestore.

Ogni articolo può essere assegnato a una categoria. Le statistiche mostrano il numero di articoli per categoria, la quota percentuale sul totale e l'avanzamento degli acquisti; per le liste già salvate, la categoria viene dedotta dal nome quando possibile.

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
5. Copia `apiKey`, `authDomain`, `projectId` e `appId` della Web App in `src/environments/environment.ts`.
6. In Firestore Rules, sostituisci `replace-with-your-email@example.com` in `firestore.rules` con l'indirizzo dell'account e pubblica le regole.
7. Distribuisci l'app su un host HTTPS e accedi con lo stesso account da ogni dispositivo.

Le regole limitano lettura e scrittura all'utente autenticato con l'indirizzo specificato. Le credenziali Firebase della Web App non sono segreti: è l'autenticazione insieme alle regole Firestore a proteggere i dati. Non committare password dell'account.

## Struttura

- `src/app/app.ts` e `src/app/app.html`: vista e interazioni dell'interfaccia.
- `src/app/shopping-list.service.ts`: stato applicativo con `signal` e valori derivati con `computed`.
- `src/app/firestore-shopping-list.service.ts`: autenticazione e operazioni realtime su Firestore.
- `src/environments/environment.ts`: configurazione Firebase.
- `firestore.rules`: accesso al database riservato all'account personale.

## Comandi

```bash
npm start
npm run build
npm test
```
