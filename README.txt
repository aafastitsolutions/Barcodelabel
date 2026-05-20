Barcode Label Studio

Aplicatie desktop pentru generare si printare etichete cu coduri de bare, QR, DataMatrix, GS1 DataMatrix si SSCC.

Functii principale
- Print Zebra prin Bitmap ZPL.
- Import Excel cu coloane: sku/continut cod, text sus, text jos.
- Preview rapid pentru prima eticheta.
- Licentiere offline pe Machine ID.
- Mod demo: maxim 5 etichete fara licenta activa.
- Update automat prin GitHub Releases.

Instalare client
1. Ruleaza installerul Barcode-Label-Studio-Setup-<versiune>.exe.
2. Deschide aplicatia.
3. Copiaza Machine ID din partea de sus.
4. Trimite Machine ID la aafastitsolutions@gmail.com pentru emiterea licentei.
5. Dupa primirea fisierului license.json, importa-l din sectiunea Zebra / licenta.

Licente
- Se pot emite licente pentru 1 luna, 6 luni sau 12 luni.
- La reinnoire, clientul primeste un license.json nou si il importa in aplicatie.
- Licenta ramane valida dupa update, pe acelasi calculator.

Update automat
- Aplicatia verifica automat daca exista o versiune noua la pornire.
- Cand update-ul este descarcat, utilizatorul poate instala imediat sau la urmatoarea pornire.

Dezvoltare
- Instalare dependinte: npm install
- Rulare in dev: npm start
- Build installer: npm run dist
- Pachet client: npm run pack-client -- --customer "SC Client SRL" --license "C:\path\license.json"

Contact licenta si suport
aafastitsolutions@gmail.com
