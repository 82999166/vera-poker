import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * Switch component with inline styles for iOS 15 WebKit compatibility.
 * oklch colors in Tailwind 4 don't render on older iOS, so we use hex fallbacks.
 */
function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  // Track internal state for uncontrolled usage
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
  const isChecked = checked !== undefined ? checked : internalChecked;

  const handleChange = (val: boolean) => {
    if (checked === undefined) {
      setInternalChecked(val);
    }
    onCheckedChange?.(val);
  };

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{
        background: isChecked ? '#d4a017' : '#3a3a3a',
      }}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={handleChange}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
        style={{ background: '#ffffff' }}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
