// footprint module — dedicated footprint canvas layer.
//
// Design Frontend Modules mapped here (see design.md "Frontend Modules"):
//   - FootprintCanvas  (Req 14.2, 14.6, 14.7, 14.8, 19.4)
//       Separate <canvas> layer drawing the last 3 live M1 footprint bars,
//       synced to the chart scales; redraw only on data/scale/layout change;
//       throttled redraw 100-125ms.
//
// The pure selection + redraw-decision logic lives in `footprintModel.ts`
// (task 15.5 / Property 19); the canvas/React shell is `FootprintCanvas.tsx`.

export {
  FOOTPRINT_DISPLAY_COUNT,
  mergeFootprint,
  selectDisplayBars,
  shouldRedraw,
  type FootprintBar,
  type FootprintViewport,
  type FootprintRenderInputs,
} from "./footprintModel";
export { FootprintCanvas, drawFootprint, type FootprintCanvasProps } from "./FootprintCanvas";
