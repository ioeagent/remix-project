import React, { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react'

// ─── ButtonGroup ──────────────────────────────────────────────────────────────

interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'lg'
  vertical?: boolean
  as?: React.ElementType
}

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ size, vertical, as: Tag = 'div', className = '', children, ...rest }, ref) => {
    const classes = [
      vertical ? 'btn-group-vertical' : 'btn-group',
      size ? `btn-group-${size}` : '',
      className,
    ].filter(Boolean).join(' ')
    return <Tag ref={ref} role="group" className={classes} {...rest}>{children}</Tag>
  }
)
ButtonGroup.displayName = 'ButtonGroup'

// ─── Context ──────────────────────────────────────────────────────────────────

interface DropdownCtxType {
  isOpen: boolean
  toggle: (e?: React.SyntheticEvent) => void
  close: (e?: React.SyntheticEvent) => void
  align?: string
}

const DropdownCtx = createContext<DropdownCtxType>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
})

// ─── Dropdown ─────────────────────────────────────────────────────────────────

interface DropdownProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onToggle'> {
  show?: boolean
  onToggle?: (isOpen: boolean, e?: React.SyntheticEvent) => void
  align?: string
  drop?: 'up' | 'down' | 'start' | 'end' | 'up-centered' | 'down-centered'
  as?: React.ElementType
  autoClose?: boolean | 'inside' | 'outside'
}

const DropdownBase = forwardRef<HTMLElement, DropdownProps>(
  ({ show, onToggle, align, drop = 'down', as: Tag = 'div', className = '', children, autoClose = true, ...rest }, ref) => {
    const [internalOpen, setInternalOpen] = useState(false)
    const containerRef = useRef<HTMLElement | null>(null)

    const isControlled = show !== undefined
    const isOpen = isControlled ? show! : internalOpen

    const toggle = (e?: React.SyntheticEvent) => {
      const next = !isOpen
      if (!isControlled) setInternalOpen(next)
      onToggle?.(next, e)
    }

    const close = (e?: React.SyntheticEvent) => {
      if (!isOpen) return
      if (!isControlled) setInternalOpen(false)
      onToggle?.(false, e)
    }

    useEffect(() => {
      if (!isOpen || autoClose === false) return
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          close()
        }
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [isOpen, autoClose])

    const dropClass =
      drop === 'up' ? 'dropup'
      : drop === 'start' ? 'dropstart'
      : drop === 'end' ? 'dropend'
      : 'dropdown'

    const classes = [dropClass, isOpen ? 'show' : '', className].filter(Boolean).join(' ')

    return (
      <DropdownCtx.Provider value={{ isOpen, toggle, close, align }}>
        <Tag
          ref={(node: any) => {
            containerRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) (ref as React.MutableRefObject<any>).current = node
          }}
          className={classes}
          {...rest}
        >
          {children}
        </Tag>
      </DropdownCtx.Provider>
    )
  }
)
DropdownBase.displayName = 'Dropdown'

// ─── Dropdown.Toggle ──────────────────────────────────────────────────────────

interface DropdownToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  split?: boolean
  variant?: string
  size?: 'sm' | 'lg'
  as?: React.ElementType
  id?: string
  bsPrefix?: string
  // passthrough for custom as= components (e.g. CustomToggle, CompilerMenuToggle)
  [key: string]: any
}

const DropdownToggle = forwardRef<HTMLButtonElement, DropdownToggleProps>(
  ({ split, variant = 'primary', size, as: Tag, id, className = '', children, bsPrefix: _b, ...rest }, ref) => {
    const { toggle } = useContext(DropdownCtx)

    if (Tag) {
      return (
        <Tag ref={ref} id={id} className={className} onClick={toggle} {...rest}>
          {children}
        </Tag>
      )
    }

    const classes = [
      'btn',
      `btn-${variant}`,
      size ? `btn-${size}` : '',
      'dropdown-toggle',
      split ? 'dropdown-toggle-split' : '',
      className,
    ].filter(Boolean).join(' ')

    return (
      <button ref={ref} id={id} type="button" className={classes} onClick={toggle} {...rest}>
        {split ? <span className="visually-hidden">Toggle Dropdown</span> : children}
      </button>
    )
  }
)
DropdownToggle.displayName = 'Dropdown.Toggle'

// ─── Dropdown.Menu ────────────────────────────────────────────────────────────

interface DropdownMenuProps extends React.HTMLAttributes<HTMLElement> {
  show?: boolean
  align?: string
  as?: React.ElementType
  renderOnMount?: boolean
  popperConfig?: object
}

const DropdownMenu = forwardRef<HTMLElement, DropdownMenuProps>(
  ({ show: showProp, align: alignProp, as: Tag = 'ul', className = '', children, renderOnMount, popperConfig: _p, ...rest }, ref) => {
    const { isOpen, align: ctxAlign } = useContext(DropdownCtx)
    const visible = showProp !== undefined ? showProp : isOpen
    const alignment = alignProp || ctxAlign

    const classes = [
      'dropdown-menu',
      alignment === 'end' ? 'dropdown-menu-end' : '',
      visible ? 'show' : '',
      className,
    ].filter(Boolean).join(' ')

    if (!visible && !renderOnMount) return null

    return (
      <Tag ref={ref} className={classes} {...rest}>
        {children}
      </Tag>
    )
  }
)
DropdownMenu.displayName = 'Dropdown.Menu'

// ─── Dropdown.Item ────────────────────────────────────────────────────────────

interface DropdownItemProps extends React.HTMLAttributes<HTMLElement> {
  active?: boolean
  disabled?: boolean
  href?: string
  as?: React.ElementType
  eventKey?: string | number
  [key: string]: any
}

const DropdownItemBase = forwardRef<HTMLElement, DropdownItemProps>(
  ({ active, disabled, href, as, className = '', onClick, children, eventKey: _e, ...rest }, ref) => {
    const Tag = as || (href ? 'a' : 'button')
    const { close } = useContext(DropdownCtx)

    const classes = [
      'dropdown-item',
      active ? 'active' : '',
      disabled ? 'disabled' : '',
      className,
    ].filter(Boolean).join(' ')

    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) { e.preventDefault(); return }
      ;(onClick as React.MouseEventHandler<HTMLElement>)?.(e)
      close(e)
    }

    return (
      <Tag
        ref={ref}
        href={href}
        className={classes}
        onClick={handleClick}
        type={Tag === 'button' ? 'button' : undefined}
        disabled={Tag === 'button' ? disabled : undefined}
        aria-disabled={disabled}
        {...rest}
      >
        {children}
      </Tag>
    )
  }
)
DropdownItemBase.displayName = 'Dropdown.Item'

// ─── Dropdown.Divider ────────────────────────────────────────────────────────

const DropdownDivider = forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className = '', ...rest }, ref) => (
    <hr ref={ref} className={['dropdown-divider', className].filter(Boolean).join(' ')} {...rest} />
  )
)
DropdownDivider.displayName = 'Dropdown.Divider'

// ─── Dropdown.Header ─────────────────────────────────────────────────────────

const DropdownHeader = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <h6 ref={ref} className={['dropdown-header', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </h6>
  )
)
DropdownHeader.displayName = 'Dropdown.Header'

// ─── Assemble Dropdown ────────────────────────────────────────────────────────

type DropdownType = typeof DropdownBase & {
  Toggle: typeof DropdownToggle
  Menu: typeof DropdownMenu
  Item: typeof DropdownItemBase
  Divider: typeof DropdownDivider
  Header: typeof DropdownHeader
}

export const Dropdown = DropdownBase as DropdownType
Dropdown.Toggle = DropdownToggle
Dropdown.Menu = DropdownMenu
Dropdown.Item = DropdownItemBase
Dropdown.Divider = DropdownDivider
Dropdown.Header = DropdownHeader

// ─── DropdownItem (standalone named export) ───────────────────────────────────
export const DropdownItem = DropdownItemBase

// ─── DropdownButton ───────────────────────────────────────────────────────────

interface DropdownButtonProps {
  title: React.ReactNode
  id: string
  variant?: string
  size?: 'sm' | 'lg'
  disabled?: boolean
  align?: string
  drop?: DropdownProps['drop']
  className?: string
  menuClassName?: string
  children?: React.ReactNode
  onToggle?: DropdownProps['onToggle']
  show?: boolean
  autoClose?: DropdownProps['autoClose']
  [key: string]: any
}

export const DropdownButton: React.FC<DropdownButtonProps> = ({
  title, variant = 'primary', size, id, disabled, align, drop, className = '', menuClassName = '', children, onToggle, show, autoClose, ...rest
}) => (
  <Dropdown drop={drop} align={align} onToggle={onToggle} show={show} autoClose={autoClose} className={className} {...rest}>
    <Dropdown.Toggle variant={variant} size={size} id={id} disabled={disabled}>
      {title}
    </Dropdown.Toggle>
    <Dropdown.Menu className={menuClassName}>
      {children}
    </Dropdown.Menu>
  </Dropdown>
)
DropdownButton.displayName = 'DropdownButton'

// ─── NavDropdown ──────────────────────────────────────────────────────────────

interface NavDropdownProps extends Omit<React.HTMLAttributes<HTMLLIElement>, 'title'> {
  title: React.ReactNode
  id?: string
  disabled?: boolean
  active?: boolean
  drop?: 'down' | 'up' | 'start' | 'end'
  align?: string
  menuVariant?: string
  as?: React.ElementType
}

const NavDropdownItem = forwardRef<HTMLElement, DropdownItemProps>(
  (props, ref) => <DropdownItemBase ref={ref} {...props} />
)
NavDropdownItem.displayName = 'NavDropdown.Item'

const NavDropdownDivider = forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  (props, ref) => <DropdownDivider ref={ref} {...props} />
)
NavDropdownDivider.displayName = 'NavDropdown.Divider'

const NavDropdownHeader = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  (props, ref) => <DropdownHeader ref={ref} {...props} />
)
NavDropdownHeader.displayName = 'NavDropdown.Header'

type NavDropdownType = React.ForwardRefExoticComponent<NavDropdownProps & { children?: React.ReactNode } & React.RefAttributes<HTMLLIElement>> & {
  Item: typeof NavDropdownItem
  Divider: typeof NavDropdownDivider
  Header: typeof NavDropdownHeader
}

const NavDropdownBase = forwardRef<HTMLLIElement, NavDropdownProps & { children?: React.ReactNode }>(
  ({ title, id, disabled, active, className = '', children, drop: _d, align: _a, menuVariant: _m, as: _as, ...rest }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLLIElement | null>(null)

    useEffect(() => {
      if (!isOpen) return
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [isOpen])

    const classes = ['nav-item', 'dropdown', isOpen ? 'show' : '', active ? 'active' : '', className].filter(Boolean).join(' ')
    const menuClasses = ['dropdown-menu', isOpen ? 'show' : ''].filter(Boolean).join(' ')

    return (
      <DropdownCtx.Provider value={{ isOpen, toggle: () => setIsOpen(v => !v), close: () => setIsOpen(false) }}>
        <li
          ref={(node) => {
            containerRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) (ref as React.MutableRefObject<HTMLLIElement | null>).current = node
          }}
          className={classes}
          id={id}
          {...rest}
        >
          <a
            href="#"
            className={['nav-link', 'dropdown-toggle', disabled ? 'disabled' : ''].filter(Boolean).join(' ')}
            role="button"
            aria-expanded={isOpen}
            onClick={(e) => { e.preventDefault(); if (!disabled) setIsOpen(v => !v) }}
          >
            {title}
          </a>
          <ul className={menuClasses}>
            {children}
          </ul>
        </li>
      </DropdownCtx.Provider>
    )
  }
)
NavDropdownBase.displayName = 'NavDropdown'

export const NavDropdown = NavDropdownBase as NavDropdownType
NavDropdown.Item = NavDropdownItem
NavDropdown.Divider = NavDropdownDivider
NavDropdown.Header = NavDropdownHeader
