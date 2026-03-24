import { appPlatformTypes, platformContext } from '@remix-ui/app'
import React, { useEffect, useState, useContext } from 'react'
import { FormattedMessage } from "react-intl"
import { pluginActionsContext } from '../state/context'
import { openCloneDialog, openFolderInSameWindow } from '../lib/pluginActions'

export const Disabled = () => {
  const platform = useContext(platformContext)

  const openFolderElectron = async (path: string) => {
    await openFolderInSameWindow(path)
  }

  const clone = async () => {
    openCloneDialog()
  }

  return (
    (platform === appPlatformTypes.desktop) ?
      <div className='p-1'>
        <div><FormattedMessage id="gitui.openFolderMessage"/></div>
        <div data-id="openFolderButtonInDisabled" onClick={async () => { await openFolderElectron(null) }} className='inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors w-full my-1'><FormattedMessage id="electron.openFolder" /></div>
        <div data-id="cloneButton" onClick={async () => { await clone() }} className='inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors w-full'><FormattedMessage id="electron.gitClone" /></div>
      </div>
      :
      <div data-id='disabled' className='text-sm w-full alert alert-warning'>
        Git is currently disabled.<br></br>
        If you are using RemixD you can use git on the terminal.<br></br>
      </div>)
}