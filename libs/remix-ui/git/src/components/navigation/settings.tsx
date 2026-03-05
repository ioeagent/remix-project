import { faCaretUp, faCaretDown, faArrowUp, faArrowDown, faArrowRotateRight, faCaretRight, faArrowsUpDown, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { CustomTooltip } from "@remix-ui/helper";
import React, { useContext, useEffect } from "react";
import { FormattedMessage } from "react-intl";
import { pluginActionsContext } from "../../state/context";

export const SettingsNavigation = ({ eventKey, activePanel, callback }) => {
  const pluginactions = React.useContext(pluginActionsContext)

  const handleClick = () => {
    if (!callback) return
    if (activePanel === eventKey) {
      callback('')
    } else {
      callback(eventKey)
    }
  }

  return (
    <>
      <div className={'flex justify-between ' + (activePanel === eventKey ? 'bg-light' : '')}>
        <span onClick={() => handleClick()} role={'button'} className='nav flex justify-start items-center w-3/4 ms-1'>
          {
            activePanel === eventKey ? <FontAwesomeIcon className='' icon={faCaretDown}></FontAwesomeIcon> : <FontAwesomeIcon className='' icon={faCaretRight}></FontAwesomeIcon>
          }
          <label className="nav ps-2 form-check-label">SETTINGS</label>

        </span>

        <span className='flex justify-end items-center w-1/4'>
          <CustomTooltip tooltipText={<FormattedMessage id="Missing values" />}>
            <button onClick={async () => { await pluginactions.loadFiles() }} className='btn btn-sm text-warning'><FontAwesomeIcon icon={faTriangleExclamation} className="" /></button>
          </CustomTooltip>

        </span>

      </div>
    </>
  );
}
