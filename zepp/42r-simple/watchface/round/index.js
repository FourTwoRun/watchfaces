// 42R Simple — v0.3.0
// Renders HH:MM (24-hour, no seconds) in FourTwoRun teal, with a smaller
// date strip ("Apr 28" — 3-letter month, mixed case, no leading-zero day)
// in white just above the time. Solid black background.
//
// Update strategy: belt-and-suspenders.
//   1. Time.onPerMinute — primary, aligned to the minute boundary.
//   2. setInterval(60s) — backup, in case onPerMinute callback goes stale
//      after a Bridge/sync interruption or AOD transition. Idempotent with
//      onPerMinute (writing the same text is visually a no-op).
//
// Diagnostic logging is enabled for every lifecycle hook and tick. When the
// stuck-time bug recurs (observed 2026-04-28: face stuck at 8:10 after Zepp
// app interaction), the Zepp DevTools / Simulator Console will show which
// callbacks fired or didn't during the stuck window.

import { log } from '@zos/utils'
import { Time, Step } from '@zos/sensor'
import { getTimeFormat, TIME_FORMAT_24 } from '@zos/settings'
import ui from '@zos/ui'

const logger = log.getLogger('42r-simple')

const COLOR_FOURTWORUN_TEAL = 0x22CFCB
const COLOR_WHITE = 0xFFFFFF
const DESIGN_WIDTH = 466
const DESIGN_HEIGHT = 466
const TIME_HEIGHT = 168
const DATE_HEIGHT = 80
const DATE_Y = 97
const DATE_TEXT_SIZE = 46
// Step strip below the time, mirrored in size and placement against the
// date strip above. Same height, same text size, same color.
const STEP_HEIGHT = 80
const STEP_Y = 289
const STEP_TEXT_SIZE = 46
const BACKUP_TICK_MS = 60_000

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatHHMM(time) {
  // Respect the watch's system-level 12h/24h preference. Read on every call
  // so changes to the setting take effect at the next tick without requiring
  // a face reload.
  const is24h = getTimeFormat() === TIME_FORMAT_24
  const h = time.getHours()
  const m = time.getMinutes()

  if (is24h) {
    return pad(h) + ':' + pad(m)
  }

  // 12-hour: 0 → 12 (midnight), 1-11 → 1-11 (AM), 12 → 12 (noon), 13-23 → 1-11 (PM).
  // No leading zero on the hour, per typical 12-hour convention.
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return h12 + ':' + pad(m)
}

function formatSteps(n) {
  // Comma-group thousands. 8432 -> "8,432". Avoiding toLocaleString since
  // QuickJS does not reliably support full Intl.
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatDate(time) {
  // Zepp Time.getMonth() convention is undocumented in the version of the
  // SDK we have on hand. Some embedded JS runtimes return 1-12 (calendar
  // month), some return 0-11 (JS Date convention). Normalize to a 0-based
  // index for the MONTHS array, defaulting to "treat anything in 1-12 as
  // calendar-month and subtract 1." If the runtime turns out to be JS-Date-
  // style (0-11), this still works for January (0 → 0) but produces an
  // off-by-one for Feb-Dec; the diagnostic log in initView will reveal it.
  const rawMonth = time.getMonth()
  const monthIdx = rawMonth >= 1 && rawMonth <= 12 ? rawMonth - 1 : rawMonth
  return MONTHS[monthIdx] + ' ' + time.getDate()
}

function nowStamp() {
  const t = new Time()
  return pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds())
}

WatchFace({
  initView() {
    logger.log(`[${nowStamp()}] initView — creating widgets + subscribing`)
    this.timeSensor = new Time()
    this.stepSensor = new Step()

    // One-time diagnostic so we can verify month indexing + 12/24h reading.
    logger.log(
      `Time fields: month=${this.timeSensor.getMonth()} ` +
      `date=${this.timeSensor.getDate()} ` +
      `timeFormat=${getTimeFormat()} ` +
      `(TIME_FORMAT_24=${TIME_FORMAT_24}) ` +
      `dateText="${formatDate(this.timeSensor)}" ` +
      `timeText="${formatHHMM(this.timeSensor)}"`
    )

    this.dateText = ui.createWidget(ui.widget.TEXT, {
      text: formatDate(this.timeSensor),
      x: 0,
      y: DATE_Y,
      w: DESIGN_WIDTH,
      h: DATE_HEIGHT,
      color: COLOR_WHITE,
      text_size: DATE_TEXT_SIZE,
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text_style: ui.text_style.NOWRAP,
    })

    this.timeText = ui.createWidget(ui.widget.TEXT, {
      text: formatHHMM(this.timeSensor),
      x: 0,
      y: (DESIGN_HEIGHT - TIME_HEIGHT) / 2,
      w: DESIGN_WIDTH,
      h: TIME_HEIGHT,
      color: COLOR_FOURTWORUN_TEAL,
      text_size: 132,
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text_style: ui.text_style.NOWRAP,
    })

    this.stepText = ui.createWidget(ui.widget.TEXT, {
      text: formatSteps(this.stepSensor.getCurrent()),
      x: 0,
      y: STEP_Y,
      w: DESIGN_WIDTH,
      h: STEP_HEIGHT,
      color: COLOR_WHITE,
      text_size: STEP_TEXT_SIZE,
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text_style: ui.text_style.NOWRAP,
    })

    this.timeSensor.onPerMinute(() => {
      logger.log(`[${nowStamp()}] onPerMinute fired`)
      this.updateDisplay()
    })

    this.backupInterval = setInterval(() => {
      logger.log(`[${nowStamp()}] backup interval fired`)
      this.updateDisplay()
    }, BACKUP_TICK_MS)
  },

  updateDisplay() {
    if (!this.timeSensor || !this.timeText || !this.dateText || !this.stepText) return
    this.timeText.setProperty(ui.prop.MORE, {
      text: formatHHMM(this.timeSensor),
    })
    this.dateText.setProperty(ui.prop.MORE, {
      text: formatDate(this.timeSensor),
    })
    if (this.stepSensor) {
      this.stepText.setProperty(ui.prop.MORE, {
        text: formatSteps(this.stepSensor.getCurrent()),
      })
    }
  },

  onInit() {
    logger.log(`[${nowStamp()}] onInit`)
  },

  build() {
    logger.log(`[${nowStamp()}] build`)
    this.initView()
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
