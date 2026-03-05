import React, { forwardRef } from 'react'

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  bg?: string
  border?: string
  text?: string
  body?: boolean
  as?: React.ElementType
}

const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['card-header', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
CardHeader.displayName = 'Card.Header'

const CardBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['card-body', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
CardBody.displayName = 'Card.Body'

const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['card-footer', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
CardFooter.displayName = 'Card.Footer'

const CardTitle = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['card-title', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
CardTitle.displayName = 'Card.Title'

const CardSubtitle = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['card-subtitle', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
CardSubtitle.displayName = 'Card.Subtitle'

const CardText = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <p ref={ref} className={['card-text', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </p>
  )
)
CardText.displayName = 'Card.Text'

const CardImg = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement> & { variant?: 'top' | 'bottom' }>(
  ({ variant, className = '', ...rest }, ref) => (
    <img
      ref={ref}
      className={['card-img', variant ? `card-img-${variant}` : '', className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
)
CardImg.displayName = 'Card.Img'

const CardImgOverlay = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['card-img-overlay', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
CardImgOverlay.displayName = 'Card.ImgOverlay'

const CardLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <a ref={ref} className={['card-link', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </a>
  )
)
CardLink.displayName = 'Card.Link'

type CardType = typeof CardBase & {
  Header: typeof CardHeader
  Body: typeof CardBody
  Footer: typeof CardFooter
  Title: typeof CardTitle
  Subtitle: typeof CardSubtitle
  Text: typeof CardText
  Img: typeof CardImg
  ImgOverlay: typeof CardImgOverlay
  Link: typeof CardLink
}

const CardBase = forwardRef<HTMLDivElement, CardProps>(
  ({ bg, border, text, body, as: Tag = 'div', className = '', children, ...rest }, ref) => {
    const classes = [
      'card',
      bg ? `bg-${bg}` : '',
      border ? `border-${border}` : '',
      text ? `text-${text}` : '',
      className,
    ].filter(Boolean).join(' ')
    return (
      <Tag ref={ref} className={classes} {...rest}>
        {body ? <div className="card-body">{children}</div> : children}
      </Tag>
    )
  }
)
CardBase.displayName = 'Card'

export const Card = CardBase as CardType
Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter
Card.Title = CardTitle
Card.Subtitle = CardSubtitle
Card.Text = CardText
Card.Img = CardImg
Card.ImgOverlay = CardImgOverlay
Card.Link = CardLink

// ─── Alert ────────────────────────────────────────────────────────────────────

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: string
  dismissible?: boolean
  onClose?: () => void
  show?: boolean
  as?: React.ElementType
}

const AlertHeading: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...rest }) => (
  <h4 className={['alert-heading', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </h4>
)
AlertHeading.displayName = 'Alert.Heading'

const AlertLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({ className = '', children, ...rest }) => (
  <a className={['alert-link', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </a>
)
AlertLink.displayName = 'Alert.Link'

type AlertType = typeof AlertBase & {
  Heading: typeof AlertHeading
  Link: typeof AlertLink
}

const AlertBase = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'primary', dismissible, onClose, show = true, as: Tag = 'div', className = '', children, ...rest }, ref) => {
    if (!show) return null
    const classes = [
      'alert',
      `alert-${variant}`,
      dismissible ? 'alert-dismissible fade show' : '',
      className,
    ].filter(Boolean).join(' ')
    return (
      <Tag ref={ref} role="alert" className={classes} {...rest}>
        {children}
        {dismissible && onClose && (
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        )}
      </Tag>
    )
  }
)
AlertBase.displayName = 'Alert'

export const Alert = AlertBase as AlertType
Alert.Heading = AlertHeading
Alert.Link = AlertLink

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  bg?: string
  pill?: boolean
  text?: string
  as?: React.ElementType
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ bg = 'primary', pill, text, as: Tag = 'span', className = '', children, ...rest }, ref) => {
    const classes = [
      'badge',
      `bg-${bg}`,
      text ? `text-${text}` : '',
      pill ? 'rounded-pill' : '',
      className,
    ].filter(Boolean).join(' ')
    return (
      <Tag ref={ref} className={classes} {...rest}>
        {children}
      </Tag>
    )
  }
)
Badge.displayName = 'Badge'

// ─── Spinner ──────────────────────────────────────────────────────────────────

interface SpinnerProps extends React.HTMLAttributes<HTMLElement> {
  animation: 'border' | 'grow'
  size?: 'sm'
  variant?: string
  as?: React.ElementType
}

export const Spinner = forwardRef<HTMLElement, SpinnerProps>(
  ({ animation, size, variant, as: Tag = 'div', className = '', ...rest }, ref) => {
    const classes = [
      `spinner-${animation}`,
      size ? `spinner-${animation}-${size}` : '',
      variant ? `text-${variant}` : '',
      className,
    ].filter(Boolean).join(' ')
    return <Tag ref={ref} className={classes} {...rest} />
  }
)
Spinner.displayName = 'Spinner'

// ─── Collapse ─────────────────────────────────────────────────────────────────

interface CollapseProps {
  in?: boolean
  children: React.ReactElement
  className?: string
  dimension?: 'height' | 'width'
}

export const Collapse: React.FC<CollapseProps> = ({ in: show, children, className = '' }) => {
  const classes = ['collapse', show ? 'show' : '', className].filter(Boolean).join(' ')
  return React.cloneElement(children, {
    className: [classes, children.props.className || ''].filter(Boolean).join(' '),
  })
}
Collapse.displayName = 'Collapse'

// ─── ListGroup ────────────────────────────────────────────────────────────────

interface ListGroupProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'flush'
  horizontal?: boolean | string
  numbered?: boolean
  as?: React.ElementType
}

interface ListGroupItemProps extends React.HTMLAttributes<HTMLElement> {
  action?: boolean
  active?: boolean
  disabled?: boolean
  variant?: string
  href?: string
  as?: React.ElementType
}

const ListGroupItem = forwardRef<HTMLElement, ListGroupItemProps>(
  ({ action, active, disabled, variant, href, as, className = '', children, ...rest }, ref) => {
    const Tag = as || (href ? 'a' : 'li')
    const classes = [
      'list-group-item',
      action ? 'list-group-item-action' : '',
      active ? 'active' : '',
      disabled ? 'disabled' : '',
      variant ? `list-group-item-${variant}` : '',
      className,
    ].filter(Boolean).join(' ')
    return (
      <Tag ref={ref} href={href} className={classes} {...rest}>
        {children}
      </Tag>
    )
  }
)
ListGroupItem.displayName = 'ListGroup.Item'

type ListGroupType = typeof ListGroupBase & {
  Item: typeof ListGroupItem
}

const ListGroupBase = forwardRef<HTMLElement, ListGroupProps>(
  ({ variant, horizontal, numbered, as, className = '', children, ...rest }, ref) => {
    const Tag = as || 'ul'
    const classes = [
      'list-group',
      variant === 'flush' ? 'list-group-flush' : '',
      horizontal === true ? 'list-group-horizontal' : typeof horizontal === 'string' ? `list-group-horizontal-${horizontal}` : '',
      numbered ? 'list-group-numbered' : '',
      className,
    ].filter(Boolean).join(' ')
    return (
      <Tag ref={ref} className={classes} {...rest}>
        {children}
      </Tag>
    )
  }
)
ListGroupBase.displayName = 'ListGroup'

export const ListGroup = ListGroupBase as ListGroupType
ListGroup.Item = ListGroupItem
