# Naturklänge im Karussell

Jedes der 5 Bilder im Startbild hat einen eigenen, ruhigen Naturklang. Besucher schalten ihn mit dem
Lautsprecher-Knopf in der Steuerleiste ein (Browser erlauben Ton erst nach einem Klick). Beim Bildwechsel
wird weich übergeblendet; unter der Leiste steht, was man hört.

| Bild | Datei | Was man hört |
|---|---|---|
| 1 · Alpendorf mit Kirche | `main/public/audio/kirche-voegel.mp3` | Ferne Kirchenglocken (drei Töne, zweimal), Vogelgezwitscher von mehreren Seiten, leiser Wind in Böen |
| 2 · Skifahrer im Sonnenlicht | `main/public/audio/bergwind-piste.mp3` | Bergwind in sanften Böen mit leisem Pfeifen, fünfmal das Schwingen von Ski im Schnee, von links nach rechts |
| 3 · Bergsee | `main/public/audio/bergsee.mp3` | Wasser plätschert ans Ufer, einzelne Tropfen, ein Hauch Wind, ein Vogel in der Ferne |
| 4 · Beleuchtete Häuser am Abend | `main/public/audio/kaminfeuer.mp3` | Knisterndes Kaminfeuer mit kleinen Knackgruppen, warmes, tiefes Rauschen der Flammen |
| 5 · Fussballplatz am Meer | `main/public/audio/meer-moewen.mp3` | Drei Wellen rollen an und laufen aus, Möwen rufen in der Ferne |

**Technik:** Alle Klänge sind künstlich erzeugt (`main/scripts/naturklaenge.py`, numpy + ffmpeg) – frei von Rechten Dritter.
Je 24 Sekunden, streng periodisch, dadurch lückenlose Schleife. MP3, 96 kbit/s, Stereo, je ca. 290 KB.
Sie werden erst geladen, wenn jemand den Ton einschaltet.

`spektrogramme_naturklaenge.png` zeigt die Klänge als Bild (Frequenz über Zeit) – so wurden sie geprüft.

**Eigene Aufnahmen verwenden:** MP3 nach `main/public/audio/` kopieren und in `data/site.json` bei `hero.slides[…].sound`
eintragen (`soundLabel` = Beschreibung). Für nahtlose Schleifen: genau 24,5 s, davon 0,25 s Vor- und Nachlauf.
