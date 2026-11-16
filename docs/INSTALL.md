# Installare Scrinium sull'iPhone senza Mac

Guida per la Fase 0. Passi verificati sulla documentazione SideStore il 16 novembre 2026
([prerequisiti](https://docs.sidestore.io/docs/installation/prerequisites),
[installazione](https://docs.sidestore.io/docs/installation/install)).
SideStore cambia spesso: se un passo non corrisponde, vale la loro documentazione.

## Cosa serve

- iPhone con iOS 15 o successivo e codice di sblocco impostato.
- Un PC Windows (non Arm, non 32 bit), solo per la prima installazione.
- Un Apple Account gratuito. Consigliato uno dedicato, diverso da quello personale.
- Wi-Fi. La rete mobile non basta.

## Prima volta: installare SideStore

1. Sul PC installa iTunes (versione Apple o Microsoft Store) e [iloader](https://iloader.app).
2. Sull'iPhone installa **LocalDevVPN** dall'App Store, aprilo e consenti la configurazione VPN.
3. Collega l'iPhone via USB, autorizza il computer, apri iloader.
4. Accedi con l'Apple Account, seleziona il dispositivo, scegli **Install SideStore (Stable)**.
5. Sull'iPhone: Impostazioni > Generali > VPN e gestione dispositivi > autorizza l'Apple Account.
6. Impostazioni > Privacy e sicurezza > attiva **Modalità sviluppatore**. Il telefono si riavvia.
7. Apri LocalDevVPN e connetti. Apri SideStore e accedi con lo stesso Apple Account.
8. In **My Apps** tocca il contatore "7 DAYS" accanto a SideStore per rinnovarlo.

## Installare Scrinium

1. Dall'iPhone apri la pagina [Releases](https://github.com/Maeco96/scrinium/releases) e scarica `Scrinium.ipa` dell'ultima build.
2. Attiva LocalDevVPN.
3. In SideStore, scheda **My Apps**, tocca **+** e scegli il file `Scrinium.ipa` da File.
4. Apri Scrinium e consenti l'accesso alla fotocamera.

## Limiti dell'Apple Account gratuito

- La firma dura 7 giorni. Allo scadere l'app non si apre finché non la rinnovi da SideStore; i dati restano.
- Massimo 3 app installate in questo modo, SideStore inclusa.
- Per rinnovare servono Wi-Fi e LocalDevVPN attivo.

## Cosa provare e riferire

- [ ] SideStore installato e rinnovato senza errori.
- [ ] Scrinium installato; in alto compare "Scrinium 0.1.0 (numero build)".
- [ ] La fotocamera chiede il permesso e mostra l'anteprima.
- [ ] Avvicinando una carta, a che distanza resta a fuoco quando riempie l'inquadratura.
- [ ] Rinnovo dopo qualche giorno, senza PC.
- [ ] Aggiornamento: installare una build successiva sopra la precedente.

Se un passo fallisce, annota il messaggio esatto e il passo.
