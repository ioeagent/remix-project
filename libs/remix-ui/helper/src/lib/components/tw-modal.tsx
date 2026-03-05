import React, { forwardRef, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ─── Modal subcomponents ──────────────────────────────────────────────────────

interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  closeButton?: boolean
  onHide?: () => void
}

const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ closeButton, onHide, className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['modal-header', className].filter(Boolean).join(' ')} {...rest}>
      {children}
      {closeButton && (
        <button type="button" className="btn-close" aria-label="Close" onClick={onHide} />
      )}
    </div>
  )
)
ModalHeader.displayName = 'Modal.Header'

const ModalTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <h5 ref={ref} className={['modal-title', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </h5>
  )
)
ModalTitle.displayName = 'Modal.Title'

const ModalBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['modal-body', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
ModalBody.displayName = 'Modal.Body'

const ModalFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['modal-footer', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
ModalFooter.displayName = 'Modal.Footer'

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  show?: boolean
  onHide?: () => void
  centered?: boolean
  size?: 'sm' | 'lg' | 'xl'
  fullscreen?: boolean | string
  backdrop?: boolean | 'static'
  keyboard?: boolean
  scrollable?: boolean
  className?: string
  dialogClassName?: string
  contentClassName?: string
  children?: React.ReactNode
  animation?: boolean
  'data-id'?: string
  [key: string]: any
}

const ModalBase: React.FC<ModalProps> = ({
  show = false,
  onHide,
  centered,
  size,
  fullscreen,
  backdrop = true,
  keyboard = true,
  scrollable,
  className = '',
  dialogClassName = '',
  contentClassName = '',
  children,
  animation: _a,
  ...rest
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)

  // ESC key handler
  useEffect(() => {
    if (!show || !keyboard) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onHide?.()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [show, keyboard, onHide])

  // Body scroll lock
  useEffect(() => {
    if (!show) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [show])

  if (!show) return null

  const dialogClasses = [
    'modal-dialog',
    centered ? 'modal-dialog-centered' : '',
    size ? `modal-${size}` : '',
    scrollable ? 'modal-dialog-scrollable' : '',
    fullscreen === true ? 'modal-fullscreen' : typeof fullscreen === 'string' ? `modal-fullscreen-${fullscreen}-down` : '',
    dialogClassName,
  ].filter(Boolean).join(' ')

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (backdrop !== 'static' && backdrop !== false && dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
      onHide?.()
    }
  }

  // Clone children to inject onHide into Modal.Header closeButton
  const clonedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && (child.type as any)?.displayName === 'Modal.Header') {
      return React.cloneElement(child as React.ReactElement<ModalHeaderProps>, { onHide })
    }
    return child
  })

  const modal = (
    <>
      <div
        className={['modal', 'fade', 'show', className].filter(Boolean).join(' ')}
        style={{ display: 'block' }}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={handleBackdropClick}
        {...rest}
      >
        <div ref={dialogRef} className={dialogClasses}>
          <div className={['modal-content', contentClassName].filter(Boolean).join(' ')}>
            {clonedChildren}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )

  return createPortal(modal, document.body)
}
ModalBase.displayName = 'Modal'

// ─── Assemble ─────────────────────────────────────────────────────────────────

type ModalType = typeof ModalBase & {
  Header: typeof ModalHeader
  Title: typeof ModalTitle
  Body: typeof ModalBody
  Footer: typeof ModalFooter
}

export const Modal = ModalBase as ModalType
Modal.Header = ModalHeader
Modal.Title = ModalTitle
Modal.Body = ModalBody
Modal.Footer = ModalFooter
