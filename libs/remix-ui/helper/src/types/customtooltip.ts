import { Placement } from '../lib/components/tw-overlay'

export type OverlayDelay = number | { show: number; hide: number }
export type OverlayTriggerRenderProps = { ref: React.Ref<any>; [key: string]: any }

export type CustomTooltipType = {
  children: React.ReactElement<any, string | React.JSXElementConstructor<any>> | ((props: OverlayTriggerRenderProps) => React.ReactElement),
  placement?: Placement,
  tooltipId?: string,
  tooltipClasses?:string,
  tooltipText: string | JSX.Element,
  tooltipTextClasses?: string
  delay?: OverlayDelay
  hide?: boolean
  show?: boolean
}
