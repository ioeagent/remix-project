import React, { useContext, useEffect } from 'react';
import { UniversalDappUI } from '../../components/UniversalDappUI';
import { SettingsUI } from '../../components/SettingsUI';
import RemixUiTerminal from '../../components/UiTerminal';
import DragBar from '../../components/DragBar';
import DappTop from '../../components/DappTop';
import { AppContext } from '../../contexts';

const PCPage: React.FC = () => {
  const {
    appState: { terminal, instance },
  } = useContext(AppContext);
  const { height } = terminal;

  return <div>
    <div
      className="flex flex-wrap m-0 pt-4"
      style={{
        height: instance.noTerminal
          ? window.innerHeight
          : window.innerHeight - height - 5,
        overflowY: 'auto',
      }}
    >
      <div className="xl:w-3/4 lg:w-2/3 md:w-7/12 inline-block pe-0">
        <div className="mx-4 my-2 flex flex-wrap">
          {instance.showLogo && <div className="w-1/6 text-center">
            <img src="/assets/logo.png" style={{ width: 95, height: 95 }} />
          </div>}
          <DappTop />
        </div>
        <UniversalDappUI />
      </div>
      <div className="xl:w-1/4 lg:w-1/3 md:w-5/12 inline-block ps-0">
        <SettingsUI />
      </div>
    </div>
    {!instance.noTerminal && (
      <>
        <DragBar />
        <RemixUiTerminal />
      </>
    )}
  </div>
};

export default PCPage;
