"use client"

import * as React from "react"
import { GripVerticalIcon } from "lucide-react"
// Note: react-resizable-panels export names can vary by build/environment.
// Node check confirmed exports are Group, Panel, Separator.
import { Panel, Group, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

// Explicitly define props to avoid TS issues if package types are missing/broken
interface ResizablePanelGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'id'> {
  direction: "horizontal" | "vertical"
  id?: string | null
  autoSaveId?: string | null
  storage?: unknown
  tagName?: string
  children?: React.ReactNode
  onLayout?: (sizes: number[]) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GroupAny = Group as any;

const ResizablePanelGroup = ({
  className,
  direction,
  ...props
}: ResizablePanelGroupProps) => {
  return (
    <GroupAny
      direction={direction}
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const ResizablePanel = Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) => {
  return (
    <Separator
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
