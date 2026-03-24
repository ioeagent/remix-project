import { useDialogDispatchers } from '@remix-ui/app'
import React from 'react'
import { useContext } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { SearchContext } from '../context/context'
import * as path from 'path'

export const Undo = () => {
  const { state, undoReplace } = useContext(SearchContext)
  const { alert } = useDialogDispatchers()
  const intl = useIntl()

  const undo = async () => {
    try {
      await undoReplace(state.undoBuffer[`${state.workspace}/${state.currentFile}`])
    } catch (e) {
      alert({
        id: 'undo_error',
        title: intl.formatMessage({ id: 'search.cannotUndoChange' }),
        message: e.message
      })
    }
  }

  return (
    <>
      {state.undoBuffer && state.undoBuffer[`${state.workspace}/${state.currentFile}`] && state.undoBuffer[`${state.workspace}/${state.currentFile}`].visible ? (
        <button
          data-id={`undo-replace-${state.currentFile}`}
          disabled={!state.undoBuffer[`${state.workspace}/${state.currentFile}`].enabled}
          onClick={async () => await undo()}
          className="undo-button inline-flex items-center justify-center w-full px-4 py-2 text-sm bg-secondary border border-gray-300 rounded text-white hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed my-3"
        >
          <div className="fas fa-undo mr-2"></div>
          <FormattedMessage id="search.undoChanges" values={{ path: path.basename(state.undoBuffer[`${state.workspace}/${state.currentFile}`].path) }} />
        </button>
      ) : null}
    </>
  )
}
