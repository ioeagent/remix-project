import React, { forwardRef } from 'react'

type ButtonVariant =
  | 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
  | 'light' | 'dark' | 'link'
  | 'outline-primary' | 'outline-secondary' | 'outline-success' | 'outline-danger'
  | 'outline-warning' | 'outline-info' | 'outline-light' | 'outline-dark'

type ButtonSize = 'sm' | 'lg'

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant
  size?: ButtonSize
  active?: boolean
  as?: React.ElementType
  href?: string
  type?: 'button' | 'submit' | 'reset'
  children?: React.ReactNode
}

const variantClass: Record<string, string> = {
  primary:           'btn-primary',
  secondary:         'btn-secondary',
  success:           'btn-success',
  danger:            'btn-danger',
  warning:           'btn-warning',
  info:              'btn-info',
  light:             'btn-light',
  dark:              'btn-dark',
  link:              'btn-link',
  'outline-primary': 'btn-outline-primary',
  'outline-secondary': 'btn-outline-secondary',
  'outline-success': 'btn-outline-success',
  'outline-danger':  'btn-outline-danger',
  'outline-warning': 'btn-outline-warning',
  'outline-info':    'btn-outline-info',
  'outline-light':   'btn-outline-light',
  'outline-dark':    'btn-outline-dark',
}

const sizeClass: Record<string, string> = {
  sm: 'btn-sm',
  lg: 'btn-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, active, as: Tag = 'button', href, type = 'button', className = '', children, ...rest }, ref) => {
    const classes = [
      'btn',
      variant ? variantClass[variant] : '',
      size ? sizeClass[size] : '',
      active ? 'active' : '',
      className,
    ].filter(Boolean).join(' ')

    if (Tag !== 'button') {
      return (
        <Tag ref={ref} href={href} className={classes} {...rest}>
          {children}
        </Tag>
      )
    }

    return (
      <button ref={ref} type={type} className={classes} {...rest}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
