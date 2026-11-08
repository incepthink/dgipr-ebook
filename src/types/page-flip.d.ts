/** Minimal typings for StPageFlip (the package ships none). */
declare module 'page-flip' {
  export interface FlipSetting {
    startPage: number
    size: 'fixed' | 'stretch'
    width: number
    height: number
    minWidth: number
    maxWidth: number
    minHeight: number
    maxHeight: number
    drawShadow: boolean
    flippingTime: number
    usePortrait: boolean
    startZIndex: number
    autoSize: boolean
    maxShadowOpacity: number
    showCover: boolean
    mobileScrollSupport: boolean
    clickEventForward: boolean
    useMouseEvents: boolean
    swipeDistance: number
    showPageCorners: boolean
    disableFlipByClick: boolean
  }
  export type FlippingState = 'user_fold' | 'fold_corner' | 'flipping' | 'read'
  export interface WidgetEvent<T = unknown> {
    data: T
    object: PageFlip
  }
  export class PageFlip {
    constructor(el: HTMLElement, settings: Partial<FlipSetting>)
    loadFromHTML(items: HTMLElement[] | NodeListOf<HTMLElement>): void
    updateFromHtml(items: HTMLElement[] | NodeListOf<HTMLElement>): void
    destroy(): void
    update(): void
    turnToPage(page: number): void
    turnToNextPage(): void
    turnToPrevPage(): void
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    flip(page: number, corner?: 'top' | 'bottom'): void
    getPageCount(): number
    getCurrentPageIndex(): number
    getOrientation(): 'portrait' | 'landscape'
    getState(): FlippingState
    on(event: 'flip', cb: (e: WidgetEvent<number>) => void): this
    on(event: 'changeState', cb: (e: WidgetEvent<FlippingState>) => void): this
    on(event: 'changeOrientation', cb: (e: WidgetEvent<'portrait' | 'landscape'>) => void): this
    on(event: 'init' | 'update', cb: (e: WidgetEvent<{ page: number; mode: string }>) => void): this
    off(event: string): void
  }
}
