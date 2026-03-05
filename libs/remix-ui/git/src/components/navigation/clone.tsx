import { faCaretUp, faCaretDown, faArrowUp, faArrowDown, faArrowRotateRight, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useContext, useEffect } from "react";
import LoaderIndicator from "./loaderindicator";

export const CloneNavigation = ({ eventKey, activePanel, callback }) => {

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
      <div className={'flex justify-between pb-1  pt-1 ' + (activePanel === eventKey? 'bg-light': '')}>
        <span data-id='clone-panel' onClick={()=>handleClick()} role={'button'} className='nav flex justify-start items-center w-3/4 ms-1'>
          {
            activePanel === eventKey ? <FontAwesomeIcon className='' icon={faCaretDown}></FontAwesomeIcon> : <FontAwesomeIcon className='' icon={faCaretRight}></FontAwesomeIcon>
          }
          <label className="ps-2 nav form-check-label ">CLONE</label>
          <LoaderIndicator></LoaderIndicator>
        </span>
      </div>
    </>
  );
}
