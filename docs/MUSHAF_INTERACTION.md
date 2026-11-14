# Mushaf Ayah Interaction Engine (Phase Q3)

## 1. Overview & Architecture

Phase Q3 introduces the **Interactive Ayah Layer** on top of the authentic 604 King Fahd Quran Complex (KFQC) / Madinah Mushaf SVG pages. The system transforms the Mushaf reader into an interactive reading experience while preserving the underlying SVG artwork as the single visual source of truth.

```
       Visual Layer (Untouched KFQC SVGs)
                      │
       ┌──────────────┴──────────────┐
       ▼                             ▼
  SvgPicture.asset          MushafInteractionLayer (Touch & Gestures)
                                     │
                                     ▼
                          MushafCoordinateMapper
                           (Screen/Local ➔ ViewBox)
                                     │
                                     ▼
                          MushafLayoutRepository
                           (Precomputed Q2 Geometry)
                                     │
                                     ▼
                          MushafInteractionCubit
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
       MushafAyahOverlay                          AyahActionSheet
   (Subtle Translucent Highlight)             (Context, Text, Play, Copy)
```

---

## 2. Coordinate Mapping: Screen ➔ Local ➔ SVG ViewBox

Touch events occur in screen/widget pixel coordinates, whereas precomputed Ayah geometry is stored in native SVG `viewBox` coordinates. The mapping pipeline is implemented in [`MushafCoordinateMapper`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/services/mushaf_coordinate_mapper.dart):

```
Screen Pointer Event (globalX, globalY)
       │
       ▼  [RenderBox.globalToLocal] (inverts InteractiveViewer zoom & pan matrix)
Widget Local Position (localX, localY)
       │
       ▼  [applyBoxFit(BoxFit.contain) destination rectangle calculation]
SVG Frame Rect (svgRect)
       │
       ▼  [ViewBox Translation & Aspect Scale]
Native SVG ViewBox Coordinate (viewBoxX, viewBoxY)
```

### Mathematical Formulation
Given:
- `contentSize = Size(availableWidth, availableHeight)`
- `viewBox = Rect.fromLTWH(vx, vy, vw, vh)`
- `destRect = getSvgDestinationRect(contentSize, viewBox)`
- `scaleX = destRect.width / viewBox.width`, `scaleY = destRect.height / viewBox.height`

For any local touch point `(lx, ly)` inside `destRect`:
$$\text{viewBoxX} = \text{viewBox.left} + \frac{lx - \text{destRect.left}}{\text{scaleX}}$$
$$\text{viewBoxY} = \text{viewBox.top} + \frac{ly - \text{destRect.top}}{\text{scaleY}}$$

### Native ViewBox Preservation
- **Pages 3 to 604**: `viewBox="0 0 345 550"` ($\text{left} = 0, \text{top} = 0, \text{width} = 345, \text{height} = 550$)
- **Pages 1 and 2**: `viewBox="-53.3109 -198.4777 345 550"` ($\text{left} = -53.3109, \text{top} = -198.4777, \text{width} = 345, \text{height} = 550$)

Touches falling in the letterbox or pillarbox empty margins outside `destRect` return `null` and do not produce false hits.

---

## 3. Gesture Arbitration

The Mushaf reader simultaneously supports multiple gestures without mutual conflict:

| Gesture | Target Action | Arbitration Mechanism |
|---|---|---|
| **Tap** | Select Ayah (or deselect if outside) | Dispatched via `onTapUp`; canceled if drag/pinch occurs |
| **Long Press** | Select Ayah + Open Action Sheet | Dispatched via `onLongPressStart`; canceled if pointer moves > `kTouchSlop` |
| **Double Tap** | Reset zoom to 1.0x | Dispatched via `onDoubleTap`; suppresses single tap |
| **Pinch-to-Zoom** | Scale page (0.8x to 4.0x) | Handled by `InteractiveViewer`; scale recognizer wins arena |
| **Pan** | Scroll zoomed page | Handled by `InteractiveViewer` when zoomed |
| **Horizontal Swipe** | Navigate Mushaf pages (1..604) | Handled by `PageView` when page zoom == 1.0x |

---

## 4. State Management: `MushafInteractionCubit`

Selection state is isolated inside [`MushafInteractionCubit`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/cubit/mushaf_interaction_cubit.dart) to prevent page rebuilds in `QuranCubit`.

### State Properties
- `selectedAyah`: `AyahBounds?` — current selection geometry.
- `selectedPage`: `int?` — page index (1..604) containing the selection.
- `isActionSheetOpen`: `bool` — modal bottom sheet presentation state.
- `playingAyah`: `int?` — currently playing audio Ayah index (separate from selection).

### Performance Optimization
Pages use `BlocSelector` to observe selection:
```dart
BlocSelector<MushafInteractionCubit, MushafInteractionState, AyahBounds?>(
  selector: (state) => state.selectedPage == widget.page ? state.selectedAyah : null,
  builder: (context, selectedAyah) => ...,
)
```
When an Ayah on page 50 is selected, only page 50 rebuilds its overlay painter. All other 603 pages ignore the state change.

---

## 5. Visual Highlight Overlay

Implemented in [`MushafAyahOverlay`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/widgets/mushaf_ayah_overlay.dart):
- **Rectangular Segments (99.9%)**: Painted as subtle rounded rectangles (`RRect.fromRectAndRadius(rect, Radius.circular(3))`).
- **Polygonal Segments (Pages 1 & 2)**: Transformed into local `Path` objects matching exact curved ornamental boundaries.
- **Editorial Color Palette**:
  - *Light Mode*: Soft Islamic Green (`#107C41`) at ~22% opacity (`Color(0x38107C41)`). Preserves high contrast against dark ink (`#231F20`).
  - *Dark Mode*: Warm Emerald Green (`#4CAF50`) at ~32% opacity (`Color(0x524CAF50)`). Enhances warm cream ink (`#ECE5D8`) without glare.
- **Transitions**: Smooth 160ms cubic opacity curve (`TweenAnimationBuilder`).

---

## 6. Ayah Action Sheet

Implemented in [`AyahActionSheet`](file:///Users/muhammedbashuaib/Documents/mishkat/mishkat_app/lib/features/quran/presentation/widgets/ayah_action_sheet.dart):
- **Context Header**: Surah name in authentic Uthmanic Arabic, Ayah number, Juz number, Mushaf page number.
- **Arabic Text Card**: Displays full verse text fetched directly from existing local `QuranData`.
- **Primary Play Action**: Connected to `QuranCubit.playAyah()`; updates dynamically to play/pause icon.
- **Secondary Actions**:
  - `نسخ`: Copies Arabic text with Surah & Ayah reference to system clipboard.
  - `التفسير`: Tagged with badge `قريباً` (ready for Phase Q4).
  - `حفظ علامة`: Tagged with badge `قريباً` (ready for Ayah bookmark persistence).

---

## 7. Programmatic Selection & Future Integration Points

Other features can select an Ayah without touch gestures:

```dart
// 1. Programmatically select Ayah by global ID (e.g., from Search or Memorization):
context.read<MushafInteractionCubit>().selectAyahByGlobal(255);

// 2. Select Ayah and immediately present the Action Sheet:
context.read<MushafInteractionCubit>().selectAyahByGlobal(255, openActionSheet: true);

// 3. Highlight playing Ayah without altering user selection (Audio sync in Q5):
context.read<MushafInteractionCubit>().setPlayingAyah(255);

// 4. Clear selection:
context.read<MushafInteractionCubit>().clearSelection();
```

### Future Roadmap Integration
- **Phase Q4 (Tafsir)**: Action Sheet `التفسير` button connects to Tafsir repository and bottom sheet viewer.
- **Phase Q5 (Audio Synchronization)**: Audio player stream dispatches `setPlayingAyah(globalAyah)` to update word/verse highlights.
- **Phase Q6 (Search Deep-Linking)**: Search result tap calls `openPage()` followed by `selectAyahByGlobal()`.
- **Memorization & Tasmee'**: Memorization target verses select automatically via `selectAyahByGlobal()`.
