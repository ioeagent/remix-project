import React, { createContext, forwardRef, useContext, useState } from 'react'

// ─── AccordionContext ──────────────────────────────────────────────────────────

interface AccordionCtxValue {
  activeKey: string | null
  toggle: (key: string) => void
}

const AccordionCtx = createContext<AccordionCtxValue>({ activeKey: null, toggle: () => {} })

// ─── useAccordionButton ────────────────────────────────────────────────────────

export function useAccordionButton(eventKey: string, callback?: () => void): (e: React.MouseEvent) => void {
  const { toggle } = useContext(AccordionCtx)
  return (e: React.MouseEvent) => {
    e.preventDefault()
    toggle(eventKey)
    callback?.()
  }
}

// ─── Accordion subcomponents ──────────────────────────────────────────────────

interface AccordionCollapseProps extends React.HTMLAttributes<HTMLDivElement> {
  eventKey?: string
}

const AccordionCollapse = forwardRef<HTMLDivElement, AccordionCollapseProps>(
  ({ eventKey, className = '', children, ...rest }, ref) => {
    const { activeKey } = useContext(AccordionCtx)
    const isOpen = eventKey !== undefined && eventKey === activeKey
    return (
      <div ref={ref} className={['accordion-collapse collapse', isOpen ? 'show' : '', className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </div>
    )
  }
)
AccordionCollapse.displayName = 'Accordion.Collapse'

// ─── Accordion ────────────────────────────────────────────────────────────────

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultActiveKey?: string
  activeKey?: string
  alwaysOpen?: boolean
}

type AccordionType = React.ForwardRefExoticComponent<AccordionProps & React.RefAttributes<HTMLDivElement>> & {
  Collapse: typeof AccordionCollapse
}

const AccordionBase = forwardRef<HTMLDivElement, AccordionProps>(
  ({ defaultActiveKey, activeKey: controlledKey, alwaysOpen: _a, className = '', children, ...rest }, ref) => {
    const [internalKey, setInternalKey] = useState<string | null>(defaultActiveKey ?? null)
    const isControlled = controlledKey !== undefined
    const activeKey = isControlled ? (controlledKey ?? null) : internalKey

    const toggle = (key: string) => {
      if (isControlled) return
      setInternalKey(prev => prev === key ? null : key)
    }

    return (
      <AccordionCtx.Provider value={{ activeKey, toggle }}>
        <div ref={ref} className={['accordion', className].filter(Boolean).join(' ')} {...rest}>
          {children}
        </div>
      </AccordionCtx.Provider>
    )
  }
)
AccordionBase.displayName = 'Accordion'

export const Accordion = AccordionBase as AccordionType
Accordion.Collapse = AccordionCollapse
