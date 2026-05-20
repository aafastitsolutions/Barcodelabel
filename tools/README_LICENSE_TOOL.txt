PAS RAPID (Tool cu interfață):

1) În proiect:
   npm install

2) Generează keys.json (o singură dată):
   npm run make-keys

3) Pornește tool-ul UI:
   npm run license-ui

4) Variante:
   A) "Generează & Salvează license.json"
      -> generează doar licența (îți cere unde să salveze).

   B) "Generează + Build + Pachet client"
      -> generează licența
      -> rulează "npm run dist"
      -> creează folder Delivery_* cu:
         - license.json
         - Installer.exe (cel mai nou din dist/)
         - README_CLIENT.txt

Notă:
- Pentru build trebuie să îți meargă electron-builder: npm run dist

IMPORTANT: pentru tool UI rulează exact: npm run license-ui (NU npm start).
