import React, { useContext, useState } from 'react'
import { MiniFileExplorer } from './miniFileExplorer'
import { Editor } from '@monaco-editor/react'
import { TemplateExplorerWizardAction } from '../../types/template-explorer-types'
import { TemplateExplorerContext } from '../../context/template-explorer-context'

interface ScriptsFinalScreenProps {
  strategy?: any
}

export function ScriptsFinalScreen(props: ScriptsFinalScreenProps) {
  const { state, dispatch, facade } = useContext(TemplateExplorerContext)

  return (
    <section className="flex flex-col gap-4 bg-light" style={{ height: '80%' }}>

      <button className="btn btn-primary btn-sm mx-4" data-id="validateWorkspaceButton" onClick={async () => {
        await facade.createWorkspace({
          workspaceName: state.workspaceName,
          workspaceTemplateName: state.workspaceTemplateChosen.value,
          opts: state.contractOptions,
          isEmpty: false,
          isGitRepo: false,
          createCommit: true,
          contractContent: state.contractCode,
          contractName: state.tokenName
        })
        facade.closeWizard()
      }}>Finish</button>
    </section>
  )
}
