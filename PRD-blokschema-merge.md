# PRD: Blokschema-layout verbetering — merge Schema Layout + fix overlapping nodes

## Problem Statement

In de blokschema-weergave van het elektrisch schema staan twee knoppen (`Schema layout` en `Blokschema`) die overlappende maar niet identieke functionaliteit bieden. Gebruikers weten niet welke knop ze moeten kiezen. Bovendien veroorzaakt het Blokschema soms volledig overlappende nodes (twee componenten op exact dezelfde X/Y-positie), waardoor de tekening onleesbaar wordt. Dit gebeurt wanneer twee nodes in dezelfde zone elk hetzelfde kind-knooppunt als kind hebben (DAG-structuur in een boomalgoritme).

## Solution

- Merge de unieke features van Schema Layout (kruising-minimalisatie, row-chunking voor grote groepen) in het Blokschema-algoritme.
- Fix de DAG→boom-conversie zodat een node met meerdere ouders aan slechts één primaire ouder wordt toegewezen, wat de overlap elimineert.
- Verwijder de knop "Schema layout" en de bijbehorende code.
- Resultaat: één knop (`Blokschema`) die correct werkt voor alle scenario's.

## User Stories

1. Als elektrotechnisch engineer wil ik één "Blokschema"-knop, zodat ik niet hoef te kiezen tussen twee overlappende opties.
2. Als engineer wil ik dat twee componenten nooit op exact dezelfde positie staan, zodat de tekening altijd leesbaar is.
3. Als engineer wil ik dat nodes met meerdere intra-zone verbindingen (DAG) correct worden geplaatst in een boomstructuur, zodat de hiërarchie duidelijk zichtbaar is.
4. Als engineer wil ik dat grote groepen nodes op hetzelfde niveau automatisch over meerdere rijen worden verdeeld (chunking), zodat zones niet te breed worden.
5. Als engineer wil ik dat de volgorde van nodes binnen een rij wordt geoptimaliseerd om kabelkruisingen te minimaliseren (barycenter-algoritme), zodat de tekening overzichtelijker is.
6. Als engineer wil ik dat onverbonden nodes (nodes zonder intra-zone edges) netjes naast de boom worden geplaatst en niet overlappen, zodat ook losse componenten zichtbaar zijn.
7. Als engineer wil ik dat de lay-out na het klikken automatisch wordt opgeslagen, zodat ik de volgende keer dezelfde weergave terugkrijg.

## Implementation Decisions

### Module: `buildTreeLayout` (aanpassen)

**Huidig probleem — DAG met gedeelde kinderen:**
In de huidige implementatie worden intra-zone edges gebruikt om een ouder-kind-relatie op te bouwen. Als node A en node B beide een edge hebben naar node C (DAG-structuur), staat C in zowel `intraChildren(A)` als `intraChildren(B)`. Bij het layouten wordt C slechts één keer geplaatst (bij de eerste verwerking). Beide A en B berekenen daarna hun eigen `cx` op basis van C's vaste positie → beide krijgen dezelfde `cx` → overlap.

**Fix — DAG→boom-resolutie:**
Na het opbouwen van `intraChildren`/`intraParents`, voor nodes met meerdere ouders:
- Kies één primaire ouder (via `compareNodes`-volgorde).
- Verwijder de node uit de `intraChildren`-lijst van alle niet-primaire ouders.
- Optioneel: voeg de niet-primaire ouders toe aan een `extraEdges`-set die als extra visuele verbinding wordt getekend maar geen layout-invloed heeft.

**Fix — isolated nodes (geen intra-zone edges):**
Nodes die door de boom-traversal niet bezocht worden via `layoutNode` (omdat ze geen ouders én geen kinderen hebben), worden via de fallback `zoneNodes.forEach(n => { if (!visited.has(n.id)) layoutNode(n.id) })` geplaatst. Dit werkt, maar heeft geen aansluiting op het `leafX`-systeem van de boom. Oplossing: gebruik dezelfde `leafX`-cursor voor isolated nodes zodat ze gegarandeerd rechts van de boom staan.

**Toe te voegen feature — `minimizeCrossings`:**
Na het opbouwen van de boom-volgorde per zone, pas `minimizeCrossings` toe op de root-volgorde. De roots van onafhankelijke subtrees vormen één "rij" op level 0. Door hun volgorde te optimaliseren (barycenter op basis van cross-zone edges), worden lijnkruisingen geminimaliseerd.

**Toe te voegen feature — `chunkNodes` voor grote zones:**
Als er meer dan `MAX_COLUMNS` nodes op hetzelfde niveau zitten (bijv. veel isolated nodes), verdeel ze over meerdere rijen via `chunkNodes`. Positioneer de extra rijen op oplopende Y-niveaus na het hoogste niveau van de boom.

### Module: `buildSchemaLayout` (verwijderen)

Nadat alle unieke features gemigreerd zijn naar `buildTreeLayout`, wordt `buildSchemaLayout` volledig verwijderd.

### Module: `applySchemaLayout` callback (verwijderen)

De React-callback `applySchemaLayout` en de bijbehorende "Schema layout"-knop worden verwijderd uit de toolbar.

### Interfaces die wijzigen

- `buildTreeLayout(currentNodes, currentEdges)` — interne logica verandert, externe interface blijft identiek.
- Geen wijzigingen aan `EdgeData`, `AppNode`, `CanvasNodeData` types.
- Geen API-wijzigingen.

## Testing Decisions

**Wat maakt een goede test:**
Test het zichtbare eindresultaat (node-posities en afwezigheid van overlaps), niet de interne datastructuren van het algoritme.

**Te testen scenario's (handmatig via Playwright of browser):**
1. Klik "Blokschema" → geen twee nodes op exact dezelfde positie (Playwright overlap-detectie script).
2. Zone met DAG (node met meerdere ouders) → parents staan naast elkaar, niet op elkaar.
3. Zone met >8 nodes op hetzelfde niveau → nodes verdeeld over meerdere rijen (chunking werkt).
4. Zone met isolated nodes (geen intra-zone edges) → nodes staan rechts van de boom, niet overlappend.
5. "Schema layout"-knop bestaat niet meer in de toolbar.

**Bestaand verifitiescript:** `C:\Users\tomva\AppData\Local\Temp\find_overlaps.py` — Playwright-script dat node-posities uit de DOM leest en overlappende paren rapporteert. Gebruik dit na implementatie om te bevestigen dat 0 overlaps overblijven.

## Out of Scope

- Wijzigingen aan de visuele stijl van nodes of edges.
- Automatische herberekening van de layout bij toevoegen van nieuwe nodes (gebruiker klikt nog steeds handmatig op de knop).
- Wijzigingen aan het `SchematicEdge`-component of de midYOverride/stagger-logica.
- Backend API-wijzigingen.
- Toevoegen van unit tests in het testframework (er zijn geen bestaande unit tests voor layout-functies).

## Further Notes

- De overlap-bug is reproduceerbaar in de QE-zone: nodes `==07=031++QE+E03` en `==01=002++QE+E02` staan beide op positie (0, 118) met breedte 568px.
- De root cause is dat `==01=002++QE+F01` (OV) als kind geldt voor zowel `==07=031++QE+E03` als `==01=002++QE+E02` in de intra-zone edge-set.
- `minimizeCrossings` en `chunkNodes` bestaan al als standalone functies in `DiagramPage.tsx` — ze hoeven niet opnieuw geschreven te worden, alleen aangeroepen in `buildTreeLayout`.
- Na de merge kan `buildSchemaLayout` volledig verwijderd worden (±80 regels minder).
