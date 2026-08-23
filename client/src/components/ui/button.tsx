/** Obsidian Observatory action primitive: native controls keep the game UI dependency-light. */
import { forwardRef, type ButtonHTMLAttributes } from "react";

const buttonVariants =
  "inline-flex items-center justify-center disabled:pointer-events-none disabled:opacity-50";

const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement>
>(({ className = "", type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={`${buttonVariants} ${className}`.trim()}
    {...props}
  />
));
Button.displayName = "Button";

export { Button, buttonVariants };
