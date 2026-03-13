import { Plugin } from '@remixproject/engine'
import React from 'react'
import { PluginViewWrapper } from '@remix-ui/helper'
import { PlansOverlay } from '@remix-ui/billing'
import * as packageJson from '../../../../../package.json'

interface PlansState {
  show: boolean
}

const profile = {
  name: 'plans',
  displayName: 'Plans',
  description: 'View and purchase plans',
  methods: ['open', 'close'],
  events: ['opened', 'closed'],
  icon: '',
  location: 'none',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

export class PlansPlugin extends Plugin {
  dispatch: React.Dispatch<any> = () => {}
  private state: PlansState = { show: false }

  constructor() {
    super(profile)
  }

  async onActivation(): Promise<void> {
    this.renderComponent()
  }

  async open(): Promise<void> {
    this.state = { show: true }
    this.renderComponent()
    this.emit('opened')
  }

  async close(): Promise<void> {
    this.state = { show: false }
    this.renderComponent()
    this.emit('closed')
  }

  setDispatch(dispatch: React.Dispatch<any>): void {
    this.dispatch = dispatch
    this.renderComponent()
  }

  renderComponent(): void {
    this.dispatch({
      state: this.state,
      plugin: this
    })
  }

  updateComponent(dispatchState: { state: PlansState; plugin: PlansPlugin }): JSX.Element {
    const { state, plugin } = dispatchState
    if (!state?.show) return <></>
    return (
      <PlansOverlay
        plugin={plugin}
        onClose={() => plugin.close()}
      />
    )
  }

  render(): JSX.Element {
    return (
      <div id="plans-plugin">
        <PluginViewWrapper plugin={this} />
      </div>
    )
  }
}
