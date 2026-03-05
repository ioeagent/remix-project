import React, { createContext, forwardRef, useContext, useState } from 'react'

// ─── TabContainer ─────────────────────────────────────────────────────────────

interface TabCtxValue {
  activeKey: string
  setActiveKey: (key: string) => void
}

const TabCtx = createContext<TabCtxValue>({ activeKey: '', setActiveKey: () => {} })

interface TabContainerProps {
  defaultActiveKey?: string
  activeKey?: string
  onSelect?: (key: string) => void
  children?: React.ReactNode
}

export const TabContainer: React.FC<TabContainerProps> = ({
  defaultActiveKey = '',
  activeKey: controlledKey,
  onSelect,
  children,
}) => {
  const [internalKey, setInternalKey] = useState(defaultActiveKey)
  const isControlled = controlledKey !== undefined
  const activeKey = isControlled ? controlledKey! : internalKey

  const setActiveKey = (key: string) => {
    if (!isControlled) setInternalKey(key)
    onSelect?.(key)
  }

  return <TabCtx.Provider value={{ activeKey, setActiveKey }}>{children}</TabCtx.Provider>
}
TabContainer.displayName = 'TabContainer'

// ─── Nav ──────────────────────────────────────────────────────────────────────

interface NavProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'tabs' | 'pills' | 'underline'
  as?: React.ElementType
}

interface NavItemProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
}

interface NavLinkProps extends React.HTMLAttributes<HTMLAnchorElement> {
  eventKey?: string
  active?: boolean
  disabled?: boolean
  href?: string
  as?: React.ElementType
}

const NavLink = forwardRef<HTMLElement, NavLinkProps>(
  ({ eventKey, active: activeProp, disabled, className = '', onClick, children, as: Tag = 'a', href = '#', ...rest }, ref) => {
    const { activeKey, setActiveKey } = useContext(TabCtx)
    const isActive = activeProp !== undefined ? activeProp : (eventKey !== undefined && eventKey === activeKey)

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      if (disabled) return
      if (eventKey !== undefined) setActiveKey(eventKey)
      onClick?.(e as any)
    }

    const classes = ['nav-link', isActive ? 'active' : '', disabled ? 'disabled' : '', className]
      .filter(Boolean).join(' ')

    return (
      <Tag ref={ref} className={classes} href={href} onClick={handleClick} aria-disabled={disabled} {...rest}>
        {children}
      </Tag>
    )
  }
)
NavLink.displayName = 'Nav.Link'

const NavItem = forwardRef<HTMLLIElement, NavItemProps>(
  ({ as: Tag = 'li', className = '', children, ...rest }, ref) => (
    <Tag ref={ref} className={['nav-item', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </Tag>
  )
)
NavItem.displayName = 'Nav.Item'

type NavType = React.ForwardRefExoticComponent<NavProps & React.RefAttributes<HTMLElement>> & {
  Item: typeof NavItem
  Link: typeof NavLink
}

const NavBase = forwardRef<HTMLElement, NavProps>(
  ({ variant, as: Tag = 'ul', className = '', children, ...rest }, ref) => {
    const variantClass = variant ? `nav-${variant}` : ''
    return (
      <Tag ref={ref} className={['nav', variantClass, className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </Tag>
    )
  }
)
NavBase.displayName = 'Nav'

export const Nav = NavBase as NavType
Nav.Item = NavItem
Nav.Link = NavLink

// ─── Tab (Content + Pane) ─────────────────────────────────────────────────────

interface TabContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const TabContent = forwardRef<HTMLDivElement, TabContentProps>(
  ({ className = '', children, ...rest }, ref) => (
    <div ref={ref} className={['tab-content', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
)
TabContent.displayName = 'Tab.Content'

interface TabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  eventKey?: string
  active?: boolean
}

const TabPane = forwardRef<HTMLDivElement, TabPaneProps>(
  ({ eventKey, active: activeProp, className = '', children, ...rest }, ref) => {
    const { activeKey } = useContext(TabCtx)
    const isActive = activeProp !== undefined ? activeProp : (eventKey !== undefined && eventKey === activeKey)
    const classes = ['tab-pane', isActive ? 'active show' : '', className].filter(Boolean).join(' ')
    return (
      <div ref={ref} className={classes} role="tabpanel" {...rest}>
        {children}
      </div>
    )
  }
)
TabPane.displayName = 'Tab.Pane'

// ─── Standalone Tab (used inside <Tabs>) ──────────────────────────────────────

const TAB_TYPE = 'Tab'

interface StandaloneTabProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eventKey?: string
  title?: React.ReactNode
  disabled?: boolean
  as?: React.ElementType
}

const StandaloneTab = forwardRef<HTMLDivElement, StandaloneTabProps>(
  ({ eventKey, className = '', children, title: _title, disabled: _d, as: _as, ...rest }, ref) => {
    const { activeKey } = useContext(TabCtx)
    const isActive = eventKey !== undefined && eventKey === activeKey
    const classes = ['tab-pane', isActive ? 'active show' : '', className].filter(Boolean).join(' ')
    return (
      <div ref={ref} className={classes} role="tabpanel" {...rest}>
        {children}
      </div>
    )
  }
)
StandaloneTab.displayName = TAB_TYPE

type TabType = {
  Content: typeof TabContent
  Pane: typeof TabPane
} & React.ForwardRefExoticComponent<StandaloneTabProps & React.RefAttributes<HTMLDivElement>>

export const Tab = StandaloneTab as unknown as TabType
Tab.Content = TabContent
Tab.Pane = TabPane

// ─── Tabs (convenience: managed tabs with tab bar + panes) ────────────────────

interface TabsProps {
  defaultActiveKey?: string
  activeKey?: string
  onSelect?: (key: string | null) => void
  id?: string
  className?: string
  children?: React.ReactNode
}

export const Tabs: React.FC<TabsProps> = ({
  defaultActiveKey,
  activeKey,
  onSelect,
  id,
  className = '',
  children,
}) => {
  // Extract tab metadata from children to build the Nav header
  const tabItems: Array<{ eventKey: string; title: React.ReactNode; disabled?: boolean }> = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && (child.type as any)?.displayName === TAB_TYPE) {
      const p = child.props as StandaloneTabProps
      if (p.eventKey !== undefined) {
        tabItems.push({ eventKey: p.eventKey!, title: p.title, disabled: p.disabled })
      }
    }
  })

  const hasStandaloneTabs = tabItems.length > 0

  return (
    <TabContainer
      defaultActiveKey={defaultActiveKey ?? ''}
      activeKey={activeKey}
      onSelect={(k) => onSelect?.(k)}
    >
      <div id={id} className={className}>
        {hasStandaloneTabs && (
          <Nav variant="tabs">
            {tabItems.map(({ eventKey, title, disabled }) => (
              <Nav.Item key={eventKey}>
                <Nav.Link eventKey={eventKey} disabled={disabled}>{title}</Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
        )}
        <TabContent>
          {children}
        </TabContent>
      </div>
    </TabContainer>
  )
}
Tabs.displayName = 'Tabs'
