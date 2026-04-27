// 42R Simple — Phase 1 → live time
// Renders HH:MM (24-hour, no seconds) centered on a black background, in
// FourTwoRun teal. Updates once per minute. No seconds tick by design — saves
// battery, matches the brand's "single moment per minute" aesthetic.

import { log } from '@zos/utils'
import { Time } from '@zos/sensor'
import ui from '@zos/ui'

const logger = log.getLogger('42r-simple')

const COLOR_FOURTWORUN_TEAL = 0x22CFCB
const DESIGN_WIDTH = 466
const DESIGN_HEIGHT = 466
const TEXT_HEIGHT = 168

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatHHMM(time) {
  return pad(time.getHours()) + ':' + pad(time.getMinutes())
}

WatchFace({
  initView() {
    this.timeSensor = new Time()

    this.timeText = ui.createWidget(ui.widget.TEXT, {
      text: formatHHMM(this.timeSensor),
      x: 0,
      y: (DESIGN_HEIGHT - TEXT_HEIGHT) / 2,
      w: DESIGN_WIDTH,
      h: TEXT_HEIGHT,
      color: COLOR_FOURTWORUN_TEAL,
      text_size: 132,
      align_h: ui.align.CENTER_H,
      align_v: ui.align.CENTER_V,
      text_style: ui.text_style.NOWRAP,
    })

    this.timeSensor.onPerMinute(() => {
      this.timeText.setProperty(ui.prop.MORE, {
        text: formatHHMM(this.timeSensor),
      })
    })
  },

  onInit() {
    logger.log('42r-simple onInit')
  },

  build() {
    logger.log('42r-simple build')
    this.initView()
  },

  onDestroy() {
    logger.log('42r-simple onDestroy')
    if (this.timeSensor) {
      this.timeSensor.offPerMinute()
    }
  },
})
