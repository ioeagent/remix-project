import React, { PropsWithChildren } from 'react'

import { NavMenu } from '../components/NavMenu'

interface Props {
  from: string
  title?: string | any
  description?: string | any
}

export const DefaultLayout = ({ children, title, description }: PropsWithChildren<Props>) => {
  return (
    <div className="flex flex-col h-full">
      <NavMenu />
      <div className="py-6 px-4 grow bg-light" style={{ overflowY: 'auto' }}>
        <div data-id={`${title}Description`}>
          <p className="text-center" style={{ fontSize: '0.8rem' }}>
            {description}
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
