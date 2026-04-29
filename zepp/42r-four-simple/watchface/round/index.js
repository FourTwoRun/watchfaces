// 42R - Four Simple — v0.1.0
// Brand-watermark watch face for Four. Layered design:
//   1. Four logo at 466×466 as a full-screen background image
//      (full saturation — white dots stay white, teal stays bright).
//   2. Date / time / steps in coral with a black outline. The outline is
//      faked by stacking 8 black copies of each TEXT widget at small
//      offsets behind the coral fill widget — Zepp's TEXT widget has no
//      native stroke property. The black outline gives the digits enough
//      contrast against the bright teal disk that no overlay dimming is
//      needed; the logo reads at full presence.
//
// Same data + lifecycle plumbing as 42r-simple v0.5.1: live HH:MM
// respecting system 12h/24h, date in "Apr 28" format, comma-grouped
// step count, defensive 5s backup tick, undocumented WatchFace
// lifecycle hook probes for instant refresh on display wake.

import { log } from '@zos/utils'
import { Time, Step } from '@zos/sensor'
import { getTimeFormat, TIME_FORMAT_24 } from '@zos/settings'
import ui from '@zos/ui'

const logger = log.getLogger('42r-four-simple')

// Foreground = coral; outline = lavender. Both are Four web-brand
// accents, so the outline reads as part of the brand palette rather
// than as a hard rule. Lavender also softens the outline visually
// vs. a stark black — slight hue shift around the digits instead of
// a chunky border.
const COLOR_FOUR_TEAL = 0x22CFCB
const COLOR_TEXT_FILL = 0xFF6236
const COLOR_TEXT_OUTLINE = 0xA27FFF

const DESIGN_WIDTH = 466
const DESIGN_HEIGHT = 466
const TIME_HEIGHT = 168
const TIME_TEXT_SIZE = 132
const TIME_OUTLINE = 2
const DATE_HEIGHT = 80
const DATE_Y = 97
const DATE_TEXT_SIZE = 46
const DATE_OUTLINE = 1
const STEP_HEIGHT = 80
const STEP_Y = 289
const STEP_TEXT_SIZE = 46
const STEP_OUTLINE = 1
const BACKUP_TICK_MS = 5_000

// 8-direction offsets for the layered-text outline. Cardinal + diagonal
// gives a fuller, gap-free outline vs. the 4-cardinal-only variant.
const OUTLINE_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
]

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatHHMM(time) {
  const is24h = getTimeFormat() === TIME_FORMAT_24
  const h = time.getHours()
  const m = time.getMinutes()
  if (is24h) return pad(h) + ':' + pad(m)
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return h12 + ':' + pad(m)
}

function formatSteps(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatDate(time) {
  const rawMonth = time.getMonth()
  const monthIdx = rawMonth >= 1 && rawMonth <= 12 ? rawMonth - 1 : rawMonth
  return MONTHS[monthIdx] + ' ' + time.getDate()
}

function nowStamp() {
  const t = new Time()
  return pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds())
}

// Create a layered "outlined" text element: 8 black copies at offsets
// behind a single coral fill copy. Returns { fill, outline } so the
// caller can update the text on every widget when content changes.
function createOutlinedText(baseProps, fillColor, outlineColor, outlineSize) {
  const outline = []
  for (const [dx, dy] of OUTLINE_OFFSETS) {
    outline.push(
      ui.createWidget(ui.widget.TEXT, Object.assign({}, baseProps, {
        x: baseProps.x + dx * outlineSize,
        y: baseProps.y + dy * outlineSize,
        color: outlineColor,
      }))
    )
  }
  const fill = ui.createWidget(ui.widget.TEXT, Object.assign({}, baseProps, {
    color: fillColor,
  }))
  return { fill, outline }
}

function setOutlinedText(group, text) {
  group.fill.setProperty(ui.prop.MORE, { text })
  for (const w of group.outline) {
    w.setProperty(ui.prop.MORE, { text })
  }
}

WatchFace({
  initView() {
    logger.log(`[${nowStamp()}] initView — creating widgets + subscribing`)
    this.timeSensor = new Time()
    this.stepSensor = new Step()

    // Layer 1: Four logo as full-screen background.
    ui.createWidget(ui.widget.IMG, {
      x: 0,
      y: 0,
      w: DESIGN_WIDTH,
      h: DESIGN_HEIGHT,
      src: 'images/four-logo.png',
    })

    // Layer 2: outlined foreground text. Creation order matters for
    // z-order: outline copies must be created before the fill so the
    // fill paints on top.
    const dateBase = {
      text: formatDate(this.timeSensor),
      x: 0,
      y: DATE_Y,
      w: DESIGN_WIDTH,
      h: DATE_HEIGHT,
      text_size: DATE_TEXT_SIZE,
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text_style: ui.text_style.NOWRAP,
    }
    this.dateGroup = createOutlinedText(dateBase, COLOR_TEXT_FILL, COLOR_TEXT_OUTLINE, DATE_OUTLINE)

    const timeBase = {
      text: formatHHMM(this.timeSensor),
      x: 0,
      y: (DESIGN_HEIGHT - TIME_HEIGHT) / 2,
      w: DESIGN_WIDTH,
      h: TIME_HEIGHT,
      text_size: TIME_TEXT_SIZE,
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text_style: ui.text_style.NOWRAP,
    }
    this.timeGroup = createOutlinedText(timeBase, COLOR_TEXT_FILL, COLOR_TEXT_OUTLINE, TIME_OUTLINE)

    const stepBase = {
      text: formatSteps(this.stepSensor.getCurrent()),
      x: 0,
      y: STEP_Y,
      w: DESIGN_WIDTH,
      h: STEP_HEIGHT,
      text_size: STEP_TEXT_SIZE,
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text_style: ui.text_style.NOWRAP,
    }
    this.stepGroup = createOutlinedText(stepBase, COLOR_TEXT_FILL, COLOR_TEXT_OUTLINE, STEP_OUTLINE)

    this.timeSensor.onPerMinute(() => {
      logger.log(`[${nowStamp()}] onPerMinute fired`)
      this.updateDisplay()
    })

    this.backupInterval = setInterval(() => {
      this.updateDisplay()
    }, BACKUP_TICK_MS)
  },

  updateDisplay() {
    if (!this.timeSensor || !this.timeGroup || !this.dateGroup || !this.stepGroup) return
    setOutlinedText(this.timeGroup, formatHHMM(this.timeSensor))
    setOutlinedText(this.dateGroup, formatDate(this.timeSensor))
    if (this.stepSensor) {
      setOutlinedText(this.stepGroup, formatSteps(this.stepSensor.getCurrent()))
    }
  },

  onInit() {
    logger.log(`[${nowStamp()}] onInit`)
  },

  build() {
    logger.log(`[${nowStamp()}] build`)
    this.initView()
  },

  onResume() {
    logger.log(`[${nowStamp()}] onResume — forcing display refresh`)
    this.updateDisplay()
  },

  onShow() {
    logger.log(`[${nowStamp()}] onShow — forcing display refresh`)
    this.updateDisplay()
  },

  onReady() {
    logger.log(`[${nowStamp()}] onReady — forcing display refresh`)
    this.updateDisplay()
  },

  onPause() {
    logger.log(`[${nowStamp()}] onPause`)
  },

  onHide() {
    logger.log(`[${nowStamp()}] onHide`)
  },

  onDestroy() {
    logger.log(`[${nowStamp()}] onDestroy`)
    if (this.timeSensor) {
      this.timeSensor.offPerMinute()
    }
    if (this.backupInterval) {
      clearInterval(this.backupInterval)
      this.backupInterval = null
    }
  },
})
