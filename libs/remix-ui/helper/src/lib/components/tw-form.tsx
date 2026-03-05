import React, { createContext, forwardRef, useContext, useId } from 'react'

// Context to carry controlId from Form.Group to Form.Control/Form.Label
const FormGroupContext = createContext<{ controlId?: string }>({})

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  validated?: boolean
}

const FormBase = forwardRef<HTMLFormElement, FormProps>(
  ({ validated, className = '', children, ...rest }, ref) => (
    <form
      ref={ref}
      className={[validated ? 'was-validated' : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </form>
  )
)
FormBase.displayName = 'Form'

// ─── Form.Group ───────────────────────────────────────────────────────────────

interface FormGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  controlId?: string
  as?: React.ElementType
}

const FormGroup = forwardRef<HTMLDivElement, FormGroupProps>(
  ({ controlId, as: Tag = 'div', className = '', children, ...rest }, ref) => (
    <FormGroupContext.Provider value={{ controlId }}>
      <Tag ref={ref} className={className} {...rest}>
        {children}
      </Tag>
    </FormGroupContext.Provider>
  )
)
FormGroup.displayName = 'Form.Group'

// ─── Form.Label ───────────────────────────────────────────────────────────────

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  column?: boolean | 'sm' | 'lg'
}

const FormLabel = forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ column, className = '', htmlFor, children, ...rest }, ref) => {
    const { controlId } = useContext(FormGroupContext)
    return (
      <label
        ref={ref}
        htmlFor={htmlFor ?? controlId}
        className={['form-label', column ? 'col-form-label' : '', className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </label>
    )
  }
)
FormLabel.displayName = 'Form.Label'

// ─── Form.Control ─────────────────────────────────────────────────────────────

interface FormControlProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  as?: 'input' | 'textarea' | 'select' | React.ElementType
  isValid?: boolean
  isInvalid?: boolean
  plaintext?: boolean
  size?: 'sm' | 'lg'
  rows?: number
  value?: string | number | readonly string[]
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  children?: React.ReactNode
}

const FormControl = forwardRef<HTMLInputElement, FormControlProps>(
  ({ as: Tag = 'input', isValid, isInvalid, plaintext, size, className = '', id, children, ...rest }, ref) => {
    const { controlId } = useContext(FormGroupContext)
    const classes = [
      plaintext ? 'form-control-plaintext' : 'form-control',
      size ? `form-control-${size}` : '',
      isValid ? 'is-valid' : '',
      isInvalid ? 'is-invalid' : '',
      className,
    ].filter(Boolean).join(' ')

    return (
      <Tag
        ref={ref}
        id={id ?? controlId}
        className={classes}
        {...rest}
      >
        {children}
      </Tag>
    )
  }
)
FormControl.displayName = 'Form.Control'

// ─── Form.Select ──────────────────────────────────────────────────────────────

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  isValid?: boolean
  isInvalid?: boolean
  size?: 'sm' | 'lg'
}

const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ isValid, isInvalid, size, className = '', id, children, ...rest }, ref) => {
    const { controlId } = useContext(FormGroupContext)
    const classes = [
      'form-select',
      size ? `form-select-${size}` : '',
      isValid ? 'is-valid' : '',
      isInvalid ? 'is-invalid' : '',
      className,
    ].filter(Boolean).join(' ')

    return (
      <select ref={ref} id={id ?? controlId} className={classes} {...rest}>
        {children}
      </select>
    )
  }
)
FormSelect.displayName = 'Form.Select'

// ─── Form.Check ───────────────────────────────────────────────────────────────

interface FormCheckProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: 'checkbox' | 'radio' | 'switch'
  label?: React.ReactNode
  isValid?: boolean
  isInvalid?: boolean
  inline?: boolean
  reverse?: boolean
}

const FormCheck = forwardRef<HTMLInputElement, FormCheckProps>(
  ({ type = 'checkbox', label, isValid, isInvalid, inline, reverse, className = '', id, children, ...rest }, ref) => {
    const { controlId } = useContext(FormGroupContext)
    const inputId = id ?? controlId
    const inputType = type === 'switch' ? 'checkbox' : type
    return (
      <div className={[
        'form-check',
        type === 'switch' ? 'form-switch' : '',
        inline ? 'form-check-inline' : '',
        reverse ? 'form-check-reverse' : '',
        className,
      ].filter(Boolean).join(' ')}>
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={['form-check-input', isValid ? 'is-valid' : '', isInvalid ? 'is-invalid' : ''].filter(Boolean).join(' ')}
          role={type === 'switch' ? 'switch' : undefined}
          {...rest}
        />
        {label && (
          <label className="form-check-label" htmlFor={inputId}>
            {label}
          </label>
        )}
        {children}
      </div>
    )
  }
)
FormCheck.displayName = 'Form.Check'

// ─── Form.Text ────────────────────────────────────────────────────────────────

interface FormTextProps extends React.HTMLAttributes<HTMLElement> {
  muted?: boolean
  as?: React.ElementType
}

const FormText: React.FC<FormTextProps> = ({ muted, as: Tag = 'div', className = '', children, ...rest }) => (
  <Tag className={['form-text', muted ? 'text-muted' : '', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </Tag>
)
FormText.displayName = 'Form.Text'

// ─── Attach subcomponents ─────────────────────────────────────────────────────

type FormType = typeof FormBase & {
  Group: typeof FormGroup
  Label: typeof FormLabel
  Control: typeof FormControl
  Select: typeof FormSelect
  Check: typeof FormCheck
  Text: typeof FormText
}

export const Form = FormBase as FormType
Form.Group = FormGroup
Form.Label = FormLabel
Form.Control = FormControl
Form.Select = FormSelect
Form.Check = FormCheck
Form.Text = FormText

// ─── InputGroup ───────────────────────────────────────────────────────────────

interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'lg'
  hasValidation?: boolean
}

const InputGroupText: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className = '', children, ...rest }) => (
  <span className={['input-group-text', className].filter(Boolean).join(' ')} {...rest}>
    {children}
  </span>
)
InputGroupText.displayName = 'InputGroup.Text'

export const InputGroup = Object.assign(
  forwardRef<HTMLDivElement, InputGroupProps>(
    ({ size, hasValidation, className = '', children, ...rest }, ref) => (
      <div
        ref={ref}
        className={[
          'input-group',
          size ? `input-group-${size}` : '',
          hasValidation ? 'has-validation' : '',
          className,
        ].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </div>
    )
  ),
  { Text: InputGroupText }
)
InputGroup.displayName = 'InputGroup'

// ─── FloatingLabel ────────────────────────────────────────────────────────────

interface FloatingLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  controlId?: string
}

export const FloatingLabel: React.FC<FloatingLabelProps> = ({ label, controlId, className = '', children, ...rest }) => (
  <div className={['form-floating', className].filter(Boolean).join(' ')} {...rest}>
    {children}
    <label htmlFor={controlId}>{label}</label>
  </div>
)

// ─── Named exports ────────────────────────────────────────────────────────────

export { FormControl }
