import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ─── Placement ────────────────────────────────────────────────────────────────

export type Placement =
  | 'auto' | 'auto-start' | 'auto-end'
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'right' | 'right-start' | 'right-end'
  | 'left' | 'left-start' | 'left-end'

// ─── Popover ──────────────────────────────────────────────────────────────────

interface PopoverHeaderProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
}

const PopoverHeader = forwardRef<HTMLElement, PopoverHeaderProps>(
  ({ as: Tag = 'div', className = '', children, ...rest }, ref) => (
    <Tag ref={ref} className={['popover-header', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  )
)
PopoverHeader.displayName = 'Popover.Header'

const PopoverBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['popover-body', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
PopoverBody.displayName = 'Popover.Body'

interface PopoverProps extends React.HTMLAttributes<HTMLDivElement> {
  id?: string
  placement?: string
}

type PopoverType = React.ForwardRefExoticComponent<PopoverProps & React.RefAttributes<HTMLDivElement>> & {
  Header: typeof PopoverHeader
  Body: typeof PopoverBody
}

const PopoverBase = forwardRef<HTMLDivElement, PopoverProps>(
  ({ id, placement, className = '', style, children, ...rest }, ref) => {
    const placementClass = placement ? `bs-popover-${placement.split('-')[0]}` : ''
    return (
      <div
        ref={ref}
        id={id}
        role="tooltip"
        className={['popover', placementClass, 'show', className].filter(Boolean).join(' ')}
        style={style}
        {...rest}
      >
        <div className="popover-arrow" />
        {children}
      </div>
    )
  }
)
PopoverBase.displayName = 'Popover'

export const Popover = PopoverBase as PopoverType
Popover.Header = PopoverHeader
Popover.Body = PopoverBody

// ─── Position helper ──────────────────────────────────────────────────────────

function computeStyle(targetEl: HTMLElement, placement: string): React.CSSProperties {
  const rect = targetEl.getBoundingClientRect()
  const [side, align] = placement.split('-')

  const style: React.CSSProperties = { position: 'fixed', zIndex: 1070 }

  switch (side) {
    case 'right':
      style.left = rect.right + 4
      style.top = align === 'end' ? rect.bottom : rect.top
      break
    case 'left':
      style.right = window.innerWidth - rect.left + 4
      style.top = align === 'end' ? rect.bottom : rect.top
      break
    case 'bottom':
      style.top = rect.bottom + 4
      style.left = align === 'end' ? rect.right : rect.left
      break
    case 'top':
      style.bottom = window.innerHeight - rect.top + 4
      style.left = align === 'end' ? rect.right : rect.left
      break
    default:
      style.left = rect.right + 4
      style.top = rect.top
  }

  return style
}

function resolveTarget(target: OverlayProps['target']): HTMLElement | null {
  if (!target) return null
  if (target && 'current' in target) return (target as React.RefObject<HTMLElement>).current
  return target as HTMLElement
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

interface OverlayProps {
  show?: boolean
  target?: React.RefObject<HTMLElement> | HTMLElement | null
  placement?: Placement
  container?: HTMLElement | null
  rootClose?: boolean
  transition?: boolean
  onHide?: () => void
  popperConfig?: {
    modifiers?: Array<{ name: string; options?: object }>
    [key: string]: any
  }
  children: React.ReactElement | ((props: any) => React.ReactElement)
}

export const Overlay: React.FC<OverlayProps> = ({
  show = false,
  target,
  placement = 'right-start',
  container,
  rootClose = false,
  onHide,
  children,
}) => {
  const contentRef = useRef<HTMLElement | null>(null)
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!show) return
    const el = resolveTarget(target)
    if (el) setPosStyle(computeStyle(el, placement))
  }, [show, target, placement])

  useEffect(() => {
    if (!show || !rootClose) return
    const handler = (e: MouseEvent) => {
      const el = e.target as Node
      if (contentRef.current && contentRef.current.contains(el)) return
      const targetEl = resolveTarget(target)
      if (targetEl && targetEl.contains(el)) return
      onHide?.()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [show, rootClose, onHide, target])

  if (!show) return null

  const setRef = (node: HTMLElement | null) => { contentRef.current = node }

  let content: React.ReactElement
  if (typeof children === 'function') {
    content = (children as (props: any) => React.ReactElement)({
      style: posStyle,
      placement,
      'data-popper-placement': placement,
      ref: setRef,
    })
  } else {
    content = React.cloneElement(children as React.ReactElement, {
      style: { ...(children as React.ReactElement).props?.style, ...posStyle },
      ref: setRef,
    })
  }

  return createPortal(content, container || document.body)
}
Overlay.displayName = 'Overlay'

// ─── OverlayTrigger ───────────────────────────────────────────────────────────

type TriggerType = 'hover' | 'focus' | 'click' | Array<'hover' | 'focus' | 'click'>

interface OverlayTriggerProps {
  overlay: React.ReactElement
  placement?: Placement
  trigger?: TriggerType
  show?: boolean
  onToggle?: (show: boolean) => void
  delay?: number | { show: number; hide: number }
  children: React.ReactElement | ((props: { ref: React.Ref<any>; [key: string]: any }) => React.ReactElement)
  defaultShow?: boolean
}

export const OverlayTrigger: React.FC<OverlayTriggerProps> = ({
  overlay,
  placement = 'top',
  trigger = 'hover',
  show: showProp,
  onToggle,
  delay,
  children,
  defaultShow = false,
}) => {
  const [internalShow, setInternalShow] = useState(defaultShow)
  const triggerRef = useRef<HTMLElement>(null)

  const isControlled = showProp !== undefined
  const isVisible = isControlled ? showProp! : internalShow

  const showDelay = typeof delay === 'number' ? delay : (delay?.show ?? 0)
  const hideDelay = typeof delay === 'number' ? delay : (delay?.hide ?? 0)
  const showTimer = useRef<ReturnType<typeof setTimeout>>()
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

  const triggers = Array.isArray(trigger) ? trigger : (trigger ? [trigger as string] : [])

  const doShow = useCallback(() => {
    clearTimeout(hideTimer.current)
    showTimer.current = setTimeout(() => {
      if (!isControlled) setInternalShow(true)
      onToggle?.(true)
    }, showDelay)
  }, [isControlled, showDelay, onToggle])

  const doHide = useCallback(() => {
    clearTimeout(showTimer.current)
    hideTimer.current = setTimeout(() => {
      if (!isControlled) setInternalShow(false)
      onToggle?.(false)
    }, hideDelay)
  }, [isControlled, hideDelay, onToggle])

  const eventProps: React.HTMLAttributes<HTMLElement> = {}
  if (triggers.includes('hover')) {
    eventProps.onMouseEnter = doShow
    eventProps.onMouseLeave = doHide
  }
  if (triggers.includes('focus')) {
    eventProps.onFocus = doShow
    eventProps.onBlur = doHide
  }
  if (triggers.includes('click')) {
    eventProps.onClick = () => (isVisible ? doHide() : doShow())
  }

  const childWithEvents = typeof children === 'function'
    ? children({ ref: triggerRef, ...eventProps })
    : React.cloneElement(children as React.ReactElement, { ref: triggerRef, ...eventProps })

  return (
    <>
      {childWithEvents}
      <Overlay
        show={isVisible}
        target={triggerRef}
        placement={placement}
        rootClose={triggers.includes('click')}
        onHide={doHide}
        transition={false}
      >
        {overlay}
      </Overlay>
    </>
  )
}
OverlayTrigger.displayName = 'OverlayTrigger'
