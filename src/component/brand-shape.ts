import { LitElement, html, css, type PropertyValues } from 'lit'
import { render, type RenderConfig, type Variant, type Alignment } from '../renderer/canvas-renderer'
import { DEFAULT_NOISE_CONFIG } from '../core/effects'
import type { ShapeName } from '../core/shapes'

export class BrandShape extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 400px;
      height: 400px;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `

  static override properties = {
    from: { type: String },
    to: { type: String },
    steps: { type: Number },
    colourFrom: { type: String, attribute: 'colour-from' },
    colourCatalyst: { type: String, attribute: 'colour-catalyst' },
    colourTo: { type: String, attribute: 'colour-to' },
    background: { type: String },
    variant: { type: String },
    noiseEnabled: { type: Boolean, attribute: 'noise' },
    layerBlurFrom: { type: Number, attribute: 'layer-blur-from' },
    layerBlurTo: { type: Number, attribute: 'layer-blur-to' },
    maskBlurEnabled: { type: Boolean, attribute: 'mask-enabled' },
    maskAngle: { type: Number, attribute: 'mask-angle' },
    maskPosition: { type: Number, attribute: 'mask-position' },
    maskHardness: { type: Number, attribute: 'mask-hardness' },
    maskBlurRadius: { type: Number, attribute: 'mask-blur-radius' },
    animateEnabled: { type: Boolean, attribute: 'animate' },
    trigger: { type: String },
    duration: { type: Number },
    align: { type: String },
    spread: { type: Number },
    noiseOpacity: { type: Number, attribute: 'noise-opacity' },
    scaleFrom: { type: Number, attribute: 'scale-from' },
    scaleTo: { type: Number, attribute: 'scale-to' },
    gradientAngle: { type: Number, attribute: 'gradient-angle' },
    gradientSpread: { type: Number, attribute: 'gradient-spread' },
    gradientCenterX: { type: Number, attribute: 'gradient-center-x' },
    gradientCenterY: { type: Number, attribute: 'gradient-center-y' },
  }

  from: ShapeName = 'organic-1'
  to: ShapeName = 'angular-3'
  steps = 8
  colourFrom = '#4B01E6'
  colourCatalyst = '#BEF958'
  colourTo = '#FEA6E1'
  background = 'transparent'
  variant: Variant = 'filled'
  noiseEnabled = false
  layerBlurFrom = 0
  layerBlurTo = 0
  maskBlurEnabled = false
  maskAngle = 0
  maskPosition = 0.5
  maskHardness = 0.5
  maskBlurRadius = 10
  animateEnabled = false
  trigger: 'enter' | 'click' = 'enter'
  duration = 1500
  align: Alignment = 'center'
  spread = 1
  noiseOpacity = 0.12
  scaleFrom = 1.15
  scaleTo = 0.95
  gradientAngle = 90
  gradientSpread = 120
  gradientCenterX = 0
  gradientCenterY = 0

  private _canvas: HTMLCanvasElement | null = null
  private _resizeObserver: ResizeObserver | null = null

  override render() {
    return html`<canvas></canvas>`
  }

  override firstUpdated() {
    this._canvas = this.shadowRoot!.querySelector('canvas')!
    this._resizeObserver = new ResizeObserver(() => this._renderShape())
    this._resizeObserver.observe(this)
  }

  override updated(_changed: PropertyValues) {
    if (this._canvas) {
      requestAnimationFrame(() => this._renderShape())
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._resizeObserver?.disconnect()
  }

  private _buildConfig(): RenderConfig {
    return {
      from: this.from,
      to: this.to,
      steps: this.steps,
      colours: {
        current: this.colourFrom,
        catalyst: this.colourTo,
        future: this.colourCatalyst,
      },
      background: this.background,
      variant: this.variant,
      noise: {
        enabled: this.noiseEnabled,
        opacity: this.noiseOpacity,
        size: DEFAULT_NOISE_CONFIG.size,
      },
      blur: {
        layerBlurFrom: this.layerBlurFrom,
        layerBlurTo: this.layerBlurTo,
        maskEnabled: this.maskBlurEnabled,
        maskAngle: this.maskAngle,
        maskPosition: this.maskPosition,
        maskHardness: this.maskHardness,
        maskBlurRadius: this.maskBlurRadius,
      },
      align: this.align,
      spread: this.spread,
      scaleFrom: this.scaleFrom,
      scaleTo: this.scaleTo,
      gradientAngle: this.gradientAngle,
      gradientSpread: this.gradientSpread,
      gradientCenterX: this.gradientCenterX,
      gradientCenterY: this.gradientCenterY,
    }
  }

  private _renderShape() {
    if (!this._canvas) return
    const rect = this.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    render(this._canvas, this._buildConfig())
  }
}

customElements.define('brand-shape', BrandShape)

declare global {
  interface HTMLElementTagNameMap {
    'brand-shape': BrandShape
  }
}
