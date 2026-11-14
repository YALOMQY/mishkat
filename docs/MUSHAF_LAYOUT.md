# Mushaf Layout & Ayah Geometry Engine (Phase Q2)

## 1. Overview & Architecture

Mishkat features an authentic King Fahd Quran Complex (KFQC) / Madinah Mushaf reader powered by 604 vector SVG pages. Rather than parsing SVG XML at runtime, Mishkat employs a **build-time extraction architecture**:

```
604 KFQC SVG Pages (assets/mushaf/pages/*.svg)
       │
       │ tools/mushaf_layout/extract_mushaf_layout.py (Build-Time Extraction)
       ▼
assets/data/mushaf-layout.json (632 KB static metadata asset)
       │
       │ MushafLayoutRepository.load()
       ▼
In-Memory Geometry Models & Spatial Index
  ├── MushafLayoutData
  ├── MushafPageGeometry (Pages 1..604)
  └── AyahBounds & AyahSegments (Ayahs 1..6236)
       │
       ▼
Sub-millisecond Hit-Testing & Menu Anchoring (< 0.05 ms)
```

This architecture achieves:
- **Zero runtime XML parsing**: No expensive SVG DOM traversal during gestures or user interaction.
- **Microsecond hit-testing**: Rapid spatial lookup (`< 50 microseconds`) via bounding-box fast-reject and direct float range checks.
- **Immutable SVGs**: 100% preservation of original KFQC vector artwork.
- **Local-First & Offline**: Static metadata bundled directly into the application binary.

---

## 2. Geometry Statistics & Integrity

| Metric | Count | Verification Status |
|---|---|---|
| **Total Pages** | 604 | 100% (1..604 contiguous) |
| **Total Ayahs** | 6,236 | 100% (1..6236 contiguous, verified against `quran.json`) |
| **Total Segments** | 11,386 | Verified against original SVG `ayahPolygon` layers |
| **Rectangular Segments** | 11,378 (99.93%) | Axis-aligned bounding boxes |
| **Polygonal Segments** | 8 (0.07%) | Pages 1 and 2 only (ornamental frame curves) |
| **Asset Size** | 632.15 KB | ~138 KB gzipped |
| **Average Query Time** | < 0.05 ms | Verified across 5,000 queries |

---

## 3. ViewBox & Coordinate Systems

All geometric coordinates in `mushaf-layout.json` are expressed in **native SVG viewBox units**:

- **Pages 3 to 604 (Standard Pages)**:
  `viewBox="0 0 345 550"`
  `left = 0.0, top = 0.0, width = 345.0, height = 550.0`
- **Pages 1 and 2 (Ornamental Frontispiece Pages)**:
  `viewBox="-53.3109 -198.4777 345 550"`
  `left = -53.3109, top = -198.4777, width = 345.0, height = 550.0`

> [!IMPORTANT]
> When mapping screen touch coordinates `(screenX, screenY)` to the Mushaf layout coordinate space in Phase Q3, the transformation must normalize the touch point into the page's SVG `viewBox` coordinates using the widget's render box and aspect ratio.

---

## 4. Metadata JSON Schema (`mushaf-layout.json`)

```json
{
  "version": 1,
  "coordinateSystem": "svg_viewbox",
  "totalPages": 604,
  "totalAyahs": 6236,
  "totalSegments": 11386,
  "totalRectSegments": 11378,
  "totalPolySegments": 8,
  "pages": [
    {
      "p": 1,
      "vb": [-53.3109, -198.4777, 345, 550],
      "ay": [
        {
          "g": 1,
          "s": 1,
          "a": 1,
          "b": [57.54, 18.31, 181.08, 48.94],
          "r": [[57.54, 18.31, 181.08, 48.94]]
        }
      ]
    }
  ]
}
```

### Key Encoding
- `p`: Page number (1..604)
- `vb`: `[left, top, width, height]` page viewBox
- `ay`: Array of Ayah geometry objects
  - `g`: `globalAyah` (1..6236)
  - `s`: Surah number (1..114)
  - `a`: Ayah number within Surah (1..N)
  - `b`: Enclosing bounding box `[left, top, right, bottom]`
  - `r`: Array of rectangle segments `[[left, top, right, bottom], ...]`
  - `p`: (Optional) Array of polygon vertices `[[x1, y1, x2, y2, ...]]`

---

## 5. Domain Models & API

Location: `lib/features/quran/data/models/mushaf_layout_models.dart`

### `MushafPageGeometry`
- `int page`: Page number (1..604).
- `Rect viewBox`: Native SVG viewBox.
- `List<AyahBounds> ayahs`: All Ayahs on this page in order.
- `AyahBounds? findAyahAt(Offset viewBoxCoordinate)`: Fast hit-testing on the page.

### `AyahBounds`
- `int globalAyah`, `int surah`, `int ayah`, `int page`.
- `Rect bounds`: Union bounding box for instant fast-reject.
- `List<AyahSegment> segments`: All geometric segments.
- `Offset samplePoint`: Guaranteed interior point, ideal for menu anchoring and testing.
- `bool contains(Offset point)`: Two-stage hit-testing (fast-reject + segment check).

### `AyahSegment`
- `AyahRectSegment`: 99.9% of segments; tests `left <= x <= right && top <= y <= bottom`.
- `AyahPolygonSegment`: 8 segments on Pages 1 & 2; uses ray-casting point-in-polygon algorithm.

---

## 6. Repository Usage

Location: `lib/features/quran/data/repositories/mushaf_layout_repository.dart`

```dart
final repo = MushafLayoutRepository();
await repo.load();

// 1. Get geometry for a page
final pageGeom = repo.getPageGeometry(1);

// 2. Lookup Ayah by global index
final ayah = repo.getAyah(1); // 1:1 Bismillah

// 3. Find page containing an Ayah
final pageNum = repo.pageForAyah(6236); // 604

// 4. Hit-test at a touch coordinate (in SVG viewBox space)
final hit = repo.findAyahAt(3, const Offset(150.0, 20.0));
if (hit != null) {
  print('Tapped: Surah ${hit.surah}, Ayah ${hit.ayah} (Global: ${hit.globalAyah})');
}
```

---

## 7. Re-generating Metadata

To re-extract or re-verify the layout data from the SVG files:

```bash
python3 tools/mushaf_layout/extract_mushaf_layout.py
```

The script automatically cross-validates against:
- `assets/data/quran.json`
- `assets/data/hafs-kfqc-manifest.json`
- ViewBox boundary constraints
