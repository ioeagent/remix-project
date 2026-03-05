import { appPlatformTypes, platformContext, onLineContext } from '@remix-ui/app';
import { Dropdown } from '@remix-ui/helper'

;
import React, { useEffect, useState, useRef, useReducer, useContext } from 'react' // eslint-disable-line
import { CompilerMenu, CompilerMenuToggle } from './compiler-menu';

export type compilerVersion = {
  path: string,
  longVersion: string,
  isDownloaded: boolean
}

interface compilerDropdownProps {
  customVersions: string[],
  selectedVersion: string,
  defaultVersion: string,
  allversions: compilerVersion[],
  handleLoadVersion: (url: string) => void,
  _shouldBeAdded: (version: string) => boolean,
  onlyDownloaded: boolean
  disabled: boolean
}

export const CompilerDropdown = (props: compilerDropdownProps) => {
  const online = useContext(onLineContext)
  const platform = useContext(platformContext)
  const { customVersions, selectedVersion, defaultVersion, allversions, handleLoadVersion, _shouldBeAdded, onlyDownloaded } = props
  return (
    <Dropdown id="versionSelector" data-id="versionSelector">
      <Dropdown.Toggle
        disabled={props.disabled}
        as={CompilerMenuToggle}
        id="dropdown-custom-components"
        className="btn btn-light w-full inline-block border form-select"
        icon={null}
        style={{
          opacity: props.disabled ? 0.5 : 1,
          cursor: props.disabled ? 'not-allowed' : 'pointer',
          pointerEvents: props.disabled ? 'none' : 'auto'
        }}
      >
        <div style={{ flexGrow: 1, overflow: 'hidden', display:'flex', justifyContent:'left' }}>
          <div className={`truncate font-sm ${props.disabled ? 'text-muted' : ''}`}>
            {customVersions.map((url, i) => {
              if (selectedVersion === url) return (<span data-id="selectedVersion" key={i}>custom</span>)
            })}
            {allversions.map((build, i) => {

              if ((selectedVersion || defaultVersion) === build.path) {
                return (<span data-id="selectedVersion" key={i}>{build.longVersion}</span>)
              }
            })}
          </div>
        </div>
      </Dropdown.Toggle>

      <Dropdown.Menu as={CompilerMenu} className="w-full form-select overflow-hidden" data-id="custom-dropdown-items">
        {allversions.length <= 0 && (
          <Dropdown.Item
            key={`default`}
            data-id='builtin'
            onClick={() => {}}
          >
            <div className='flex w-full justify-between'>
              {selectedVersion === defaultVersion ? <span className='fas fa-check text-success me-2'></span> : null}
              <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <div className="truncate">
                  {defaultVersion}
                </div>
              </div>
            </div>
          </Dropdown.Item>
        )}
        {allversions.length <= 0 && (
          <Dropdown.Item
            key={`builtin`}
            data-id='builtin'
            onClick={() => {}}
          >
            <div className='flex w-full justify-between'>
              {selectedVersion === "builtin" ? <span className='fas fa-check text-success me-2'></span> : null}
              <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <div className="truncate">
                  builtin
                </div>
              </div>
            </div>
          </Dropdown.Item>
        )}
        {customVersions.map((url, i) => (
          <Dropdown.Item
            key={`custom-${i}`}
            data-id={`dropdown-item-${url}`}
            onClick={() => handleLoadVersion(url)}
          >
            <div className='flex w-full justify-between'>
              {selectedVersion === url ? <span className='fas fa-check text-success me-2'></span> : null}
              <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <div className="truncate">
                  custom: {url}
                </div>
              </div>
            </div>
          </Dropdown.Item>
        ))}
        {allversions.map((build, i) => {
          if (onlyDownloaded && !build.isDownloaded) return null
          return _shouldBeAdded(build.longVersion) ? (
            <Dropdown.Item
              key={`soljson-${i}`}
              data-id={`dropdown-item-${build.path}`}
              onClick={() => handleLoadVersion(build.path)}
            >
              <div className='flex w-full justify-between'>
                {selectedVersion === build.path ? <span className='fas fa-check text-success me-2'></span> : null}
                <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                  <div className="truncate">
                    {build.longVersion}
                  </div>
                </div>
                {platform == appPlatformTypes.desktop ? (build.isDownloaded ? <div className='fas fa-arrow-circle-down text-success ms-auto'></div> : <div className='far fa-arrow-circle-down'></div>) : null}
              </div>
            </Dropdown.Item>
          ) : null
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
}