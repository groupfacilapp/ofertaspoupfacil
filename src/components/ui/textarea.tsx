import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-base transition-all duration-200 outline-none placeholder:text-zinc-400 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-primary/60 dark:focus-visible:ring-primary/15 dark:disabled:bg-zinc-900/80",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
