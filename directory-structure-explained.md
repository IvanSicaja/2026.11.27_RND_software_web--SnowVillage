# Ordnerstruktur – was liegt wo?

```
2026.11.03_GitHub_PRJ_steinbach-website_SmartCodeACADEMY_Official/
│
│
├── .gitignore                                      # Dateien, die Git ignoriert (node_modules, Test-Ergebnisse, .env)
│
├── README.md                                       # Projektübersicht: Starten, Inhalte ändern, Testen
│
├── directory-structure-explained.md                # Diese Datei – erklärt jeden Ordner
│
├── draft_requirements_python-3.11.9.txt            # Python-Pakete für Hilfsskripte (Pillow); die Website selbst braucht nur Node.js
│
├── git_light.txt                                   # Die wichtigsten Git-Befehle für dieses Projekt
│
├── assets/                                         # Projekt-Ressourcen, die nicht direkt von der Website geladen werden (Quellen, Vorlagen)
│   │
│   ├── 01_media/                                   # Medien
│   │   │
│   │   ├── 01_icons                                # Logo / Favicon als Quelldatei (logo.svg)
│   │   ├── 02_figures                              # Screenshots (Handy, Wetter, 360°) + Übersicht der vier Jahreszeiten
│   │   ├── 03_sounds                               # Audio (aktuell leer)
│   │   ├── 04_videos                               # Eigene Rohvideos vor dem Hochladen auf YouTube (aktuell leer)
│   │   └── 05_ads                                  # Werbematerial: Teilen-Vorschaubild für Social Media (1200×630)
│   └── 02_3d-modeling                              # 3D-Modelle (aktuell leer)
│
├── bills                                           # Rechnungen: Domain, Hosting, Fotograf usw. (aktuell leer)
│
├── copyright                                       # Lizenzen von Drittanbietern, Bildnachweis (bildnachweis.md)
│
├── data                                            # INHALTE DER WEBSITE – hier wird bearbeitet, ohne zu programmieren
│   ├── site.json                                   #   Dorfname, Koordinaten, Karussell-Bilder, Texte, Dorfleben, Kontakt, Karten-Einstellungen
│   ├── media.json                                  #   360°-Panoramen (4 Jahreszeiten), Galerie, Videos, Ausflugsziele
│   ├── karte.geojson                               #   Routen (Wandern, Laufen, Velo) + Aussichtspunkte → "npm run karte" aus Google My Maps
│   ├── articles/                                   #   Blog-Artikel als Markdown (.md) – erscheinen sofort online
│   └── fotos/                                      #   Eigene Original-Fotos (galerie/, orte/, blog/) → "npm run bilder"
│
├── docs/                                           # Dokumentation
│   │
│   └── 01_skills-used/                             # Verwendete Technologien
│       │
│       └── skills.txt                              # Liste aller Technologien und Fähigkeiten
│
├── main                                            # QUELLCODE DER WEBSITE (Node.js)
│   ├── server.js                                   #   Einstiegspunkt – startet die Website ("npm start")
│   ├── package.json                                #   Node.js-Pakete und Befehle
│   ├── src/                                        #   Server: Seiten-Vorlagen, Inhalte, Karte, Wetter, KML-Import
│   ├── public/                                     #   Ausgelieferte Dateien: CSS, JavaScript, Bilder, Panoramen
│   └── scripts/                                    #   Hilfsskripte: Karte importieren, Fotos umwandeln, 360°-Jahreszeiten rendern
│
├── models/                                         # KI-Modelle (in diesem Projekt nicht verwendet)
│   │
│   ├── 01_downloaded                               # Heruntergeladene Modelle (leer)
│   └── 02_trained                                  # Selbst trainierte Modelle (leer)
│
├── notebooks                                       # Jupyter-Notebooks (aktuell leer)
│
├── publish                                         # Fertige Versionen zum Veröffentlichen (z. B. ZIP für den Server)
│
├── tests                                           # Automatische Tests
│   ├── unit/                                       #   Server-, Inhalts- und Sicherheitstests (node:test)
│   ├── e2e/                                        #   Browser-Tests Desktop + Handy, Barrierefreiheit (Playwright + axe)
│   ├── fixtures/                                   #   Beispieldateien für Tests (KML aus Google My Maps, GPX)
│   ├── package.json                                #   Markiert die Tests als ES-Module (Pakete kommen aus main/)
│   └── playwright.config.js                        #   Einstellungen der Browser-Tests
│
└── viz/                                            # Visualisierungen
    │
    ├── 01_mind-maps                                # Mind-Map der Website-Struktur (Mermaid, .mmd)
    └── 02_tableau                                  # Tableau-Arbeitsmappen (leer)
```

## Wo ändere ich was?

| Ich möchte … | Datei / Ordner |
|---|---|
| Koordinaten des Dorfes (Wetter + Karte) | `data/site.json` → `location` |
| Die 5 Bilder im Karussell ändern | `data/site.json` → `hero.slides` |
| Routen & Aussichtspunkte ändern | Google My Maps → KML → in `main/`: `npm run karte -- datei.kml` |
| Texte, Kontakt, Öffnungszeiten ändern | `data/site.json` |
| Bilder, Videos, Panoramen, Ausflugsziele ändern | `data/media.json` |
| Einen Blog-Artikel schreiben | neue `.md`-Datei in `data/articles/` |
| Eigene Fotos einbauen | `data/fotos/…` → in `main/` `npm run bilder` |
| Die 5 Bilder / Text im Startbild | `data/site.json` → `hero.slides`, `intro.title` (Überschrift im Bild) |
| Eigenes 360°-Foto einbauen | JPG nach `main/public/images/panorama/` + Eintrag in `data/media.json` |
| Farben, Abstände, Ecken ändern | `main/public/css/style.css` (oben, Abschnitt `:root`) |
| Seitenaufbau ändern | `main/src/views.js` |
