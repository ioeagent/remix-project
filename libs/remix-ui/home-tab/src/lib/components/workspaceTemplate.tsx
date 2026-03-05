/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useContext } from 'react'
import { CustomTooltip } from '@remix-ui/helper'
import { ThemeContext } from '../themeContext'

interface WorkspaceTemplateProps {
  gsID: string
  workspaceTitle: string
  projectLogo: string
  callback: any
  description: string
}

function WorkspaceTemplate({ gsID, workspaceTitle, description, projectLogo, callback }: WorkspaceTemplateProps) {
  const themeFilter = useContext(ThemeContext)

  return (
    <div className="flex remixui_home_workspaceTemplate">
      <button
        className="btn border-secondary p-1 flex flex-col  whitespace-nowrap justify-center me-2 remixui_home_workspaceTemplate"
        data-id={'landingPageStart' + gsID}
        onClick={() => callback()}
      >
        <div className="w-full p-1 h-full items-center flex flex-col">
          <CustomTooltip placement={'top'} tooltipClasses="text-wrap" tooltipId="etherscan-receipt-proxy-status" tooltipText={description}>
            <div className='flex flex-col items-center'>
              <label className="h5 pb-1 mt-1 uppercase remixui_home_cursorStyle" style={{ color: themeFilter.name == "dark" ? "var(--white)" : "var(--black)" }}>{workspaceTitle}</label>
              <img className="" src={projectLogo} alt="" style={{ height: "20px", filter: themeFilter.name == "dark" ? "invert(1)" : "invert(0)" }} />
            </div>
          </CustomTooltip>
        </div>
      </button>
    </div>
  )
}

export default WorkspaceTemplate
