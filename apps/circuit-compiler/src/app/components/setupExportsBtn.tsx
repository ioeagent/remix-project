import { CustomTooltip, RenderIf } from "@remix-ui/helper"
import { FormattedMessage } from "react-intl"
import { CompilerStatus } from "../types"

export function SetupExportsBtn ({ handleRunSetup, status }: { handleRunSetup: () => Promise<void>, status: CompilerStatus }) {
  return <button
    className="btn btn-secondary btn-block block w-full break-words mt-2"
    onClick={handleRunSetup}
    data-id="runSetupBtn"
  >
    <CustomTooltip
      placement="auto"
      tooltipId="overlay-tooltip-compile"
      tooltipText={
        <div className="text-left">
          <div>
              Click to setup and export verification keys
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-center">
        <RenderIf condition={status === 'exporting'}>
          <i className="fas fa-sync fa-spin me-2" aria-hidden="true"></i>
        </RenderIf>
        <div className="truncate overflow-hidden whitespace-nowrap">
          <span>
            <FormattedMessage id="circuit.runSetup" />
          </span>
        </div>
      </div>
    </CustomTooltip>
  </button>
}