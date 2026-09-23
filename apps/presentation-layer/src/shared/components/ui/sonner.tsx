import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { ArrowRotateRight, Check, CircleInfo, TriangleExclamation, Xmark } from "@gravity-ui/icons"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <Check className="size-4" aria-hidden="true" />
        ),
        info: (
          <CircleInfo className="size-4" aria-hidden="true" />
        ),
        warning: (
          <TriangleExclamation className="size-4" aria-hidden="true" />
        ),
        error: (
          <Xmark className="size-4" aria-hidden="true" />
        ),
        loading: (
          <ArrowRotateRight className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
