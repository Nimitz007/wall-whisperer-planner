import * as React from "react";
import { cn } from "@/lib/utils";

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, id, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);

    const handleFocus = () => setIsFocused(true);
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(e.target.value !== "");
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value !== "");
      props.onChange?.(e);
    };

    React.useEffect(() => {
      if (props.value !== undefined && props.value !== "") {
        setHasValue(true);
      }
    }, [props.value]);

    const isActive = isFocused || hasValue;

    return (
      <div className="relative">
        <input
          id={id}
          ref={ref}
          className={cn(
            "peer w-full h-10 px-3 py-2 text-base md:text-sm bg-background border rounded-lg outline-none transition-all duration-200",
            "placeholder-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "focus:border-primary",
            isFocused ? "border-primary" : "border-input",
            className
          )}
          placeholder={label}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "absolute left-2 px-1 bg-background transition-all duration-200 pointer-events-none",
            isActive
              ? "-top-2.5 text-xs"
              : "top-1/2 -translate-y-1/2 text-sm",
            isFocused ? "text-primary" : "text-muted-foreground"
          )}
        >
          {label}
          {props.required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      </div>
    );
  }
);

FloatingInput.displayName = "FloatingInput";

export { FloatingInput };
