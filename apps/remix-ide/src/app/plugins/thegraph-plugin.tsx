import { ViewPlugin } from '@remixproject/engine-web'
import React from 'react'
import { TheGraph } from '@remix-ui/thegraph'
import * as packageJson from '../../../../../package.json'

// The Graph logo as inline SVG
const THEGRAPH_ICON = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'>
  <circle cx='12' cy='12' r='10' stroke='%236f4cff' stroke-width='2'/>
  <circle cx='12' cy='5' r='2' fill='%236f4cff'/>
  <circle cx='19' cy='16' r='2' fill='%236f4cff'/>
  <circle cx='5' cy='16' r='2' fill='%236f4cff'/>
  <line x1='12' y1='7' x2='17.5' y2='14.5' stroke='%236f4cff' stroke-width='1.5'/>
  <line x1='12' y1='7' x2='6.5' y2='14.5' stroke='%236f4cff' stroke-width='1.5'/>
  <line x1='7' y1='16' x2='17' y2='16' stroke='%236f4cff' stroke-width='1.5'/>
</svg>`

const profile = {
  name: 'thegraph',
  displayName: 'The Graph',
  description: 'Discover, create, and query subgraphs with The Graph Protocol',
  methods: [],
  events: [],
  icon: THEGRAPH_ICON,
  location: 'sidePanel',
  version: packageJson.version,
  maintainedBy: 'Remix'
}

export class TheGraphPlugin extends ViewPlugin {
  constructor() {
    super(profile)
  }

  render(): JSX.Element {
    return (
      <div id="theGraphTab" style={{ height: '100%', position: 'relative' }}>
        <TheGraph plugin={this} />
      </div>
    )
  }
}
