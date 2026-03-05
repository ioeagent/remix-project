import React from 'react'

interface Props {
  environment: 'remote' | 'local'
}

function WarnRemoteLabel({environment}: Props) {
  if (environment === 'local') {
    return <></>
  }

  return (
    <small className="mx-6 text-warning pb-6"></small>
  )
}

export default WarnRemoteLabel
