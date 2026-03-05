import React, { Dispatch } from 'react'
import { AiAssistantType, AiContextType, groupListType } from '../types/componentTypes'

export interface GroupListMenuProps {
  setChoice: Dispatch<React.SetStateAction<AiContextType | AiAssistantType | any>>
  choice: AiContextType | AiAssistantType | any
  setShowOptions: Dispatch<React.SetStateAction<boolean>>
  groupList: groupListType[]
}

export default function GroupListMenu(props: GroupListMenuProps) {

  return (
    <div className="btn-group-vertical w-full">
      {props.groupList.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          className={`btn btn-light border border-0`}
          data-id={item.dataId}
          onClick={() => {
            props.setChoice(item.stateValue)
            props.setShowOptions(false)
          }}
        >
          <div className="flex flex-col small text-left">
            <span className="form-check-label font-bold mb-1">{item.label}</span>
            <div className="flex justify-between">
              <span className="form-check-label me-2 text-wrap">{item.bodyText}</span>{ props.choice === item.stateValue && <span className={item.icon}></span> }
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
