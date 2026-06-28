# PRD: Uniforme routing engine — geen intra/cross-zone onderscheid

## Problem Statement

De huidige routinglogica maakt een kunstmatig onderscheid tussen kabels binnen dezelfde ruimte (intra-zone) en kabels tussen ruimtes (cross-zone). Dit onderscheid bestaat puur omdat het lay-outalgortime per zone werkt en achteraf speciale gevallen moet afhandelen voor grensoverschrijdende kabels. Het gevolg is twee aparte codepaden voor hetzelfde concept (een verbinding tussen twee componenten), extra complexiteit in de lay-out (linker-marge-handles, `midYOverride`, `assignCrossZoneOffsets`), en moeilijk uitbreidbaar gedrag wanneer zones anders gerangschikt worden.

## Solution

Vervang de zone-bewuste routinglogica door een uniforme routing engine die na de nodeplacement werkt. De engine kent alleen knooppuntcoördinaten en verbindingen — geen zones. Alle kabels worden op dezelfde manier gerouted: orthogonale paden (omlaag → horizontaal → omhoog), met staggering voor parallelle kabels en brug-arcs op kruispunten. Het onderscheid intra/cross-zone verdwijnt volledig uit de codebase.

## User Stories

1. Als engineer wil ik dat alle kabels op een uniforme manier worden gerouted, zodat de tekening consistent leesbaar is ongeacht of een kabel een zonegrens overschrijdt.
2. Als engineer wil ik dat parallelle kabels tussen dezelfde twee nodes automatisch gestaggerd worden op de horizontale busbaan, zodat ik elke kabel individueel kan volgen.
3. Als engineer wil ik dat parallelle kabels tussen *verschillende* nodeparen maar in dezelfde corridor ook gestaggerd worden, zodat kabelbundels niet op elkaar liggen.
4. Als engineer wil ik dat brug-arcs correct getekend worden op alle kruispunten, ongeacht of de kabels intra- of cross-zone zijn.
5. Als engineer wil ik dat kabelreferentielabels leesbaar blijven op zowel verticale als horizontale segmenten.
6. Als engineer wil ik dat de lay-out na het verwijderen van de speciale cross-zone logica nog steeds correct werkt, zodat er geen regressie is in de bestaande weergave.

## Implementation Decisions

### Wat verdwijnt

- `assignCrossZoneOffsets` — de functie die cross-zone edges een `midYOverride` geeft op basis van zonecorridor-groepering. Wordt vervangen door de uniforme router.
- Linker-marge-handle logica in `buildTreeLayout` — de speciale berekening van `crossZoneRight` en het plaatsen van cross-zone handles in de linker marge van de node. Vervangen door uniforme handle-spreading.
- `midYOverride` veld in `EdgeData` — of gegeneraliseerd naar een veld dat de uniforme router voor elke edge zet.

### Nieuwe module: `routeEdges(edges, nodes)`

Een pure functie die na nodeplacement werkt:

- **Input**: alle edges (met source/target node-IDs) en alle nodes (met posities en breedte)
- **Output**: edges verrijkt met `routedSourceX`, `routedTargetX`, `routedMidY` per edge
- **Algoritme**:
  1. Groepeer edges per (sourceX-band, targetX-band) corridor — dit is zone-agnostisch
  2. Binnen elke corridor: sorteer op source X, ken oplopende `midY` toe (`sourceBottomY + offset + i * GAP`)
  3. Alle edges, zowel intra als cross, doorlopen dezelfde logica

### Handle-spreading

- Vervang de aparte behandeling van cross-zone handles (linker marge) door uniforme spreading over de volledige nodebreedte, net als intra-zone handles
- `HANDLE_SPREAD` kan verhoogd worden zodat meerdere kabels naar hetzelfde kind ook horizontaal uiteen staan

### `computeEdgePath` vereenvoudigen

- Verwijder de `midYOverride`-check als speciale code; vervang door het uniforme `routedMidY` veld dat de routing engine altijd zet
- De functie wordt een eenvoudige lookup van voorberekende routingdata

### `buildEdges` pipeline

Huidige volgorde: `orientEdges → assignCrossZoneOffsets → addCrossingData`

Nieuwe volgorde: `orientEdges → routeEdges → addCrossingData`

`routeEdges` vervangt `assignCrossZoneOffsets` en werkt op alle edges uniform.

## Testing Decisions

**Wat maakt een goede test**: test het zichtbare eindresultaat (geen overlappende kabellijnen, correcte brug-arcs, staggering zichtbaar), niet de interne routingdata.

**Te testen via Playwright**:
1. Na klikken "Blokschema": geen twee kabels op exact dezelfde horizontale busbaan (zelfde `midY`) tenzij ze ook dezelfde X-band hebben.
2. Kabels tussen zones staan visueel uiteen (staggering).
3. Brug-arcs verschijnen correct op kruispunten.
4. Geen regressie: node-node overlaps blijven 0.

**Isoleerbare unit**: `routeEdges` is een pure functie (nodes + edges in, verrijkte edges uit) en kan getest worden zonder browser of React.

## Out of Scope

- Wijziging van het nodeplacement-algoritme (`buildTreeLayout`).
- Curved of diagonale routingpaden — orthogonaal blijft de standaard.
- Automatische herberekening van routing bij handmatig verslepen van nodes.
- Backend API-wijzigingen.

## Further Notes

- De huidige `CROSS_ZONE_TRACK_GAP = 14px` en `routeOffset`-logica kunnen als startpunt dienen voor de uniforme staggeringconstante.
- `midYOverride` in `EdgeData` en `SchematicEdge` kan behouden blijven als intern veld dat de routing engine zet — de naam kan eventueel hernoemd worden naar `routedMidY` voor duidelijkheid.
- Dit is een refactoring met gedragsbehoud: de tekening ziet er gelijk of beter uit, maar de code is eenvoudiger en uitbreidbaarder.
