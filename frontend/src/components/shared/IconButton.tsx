import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  active?: boolean;
  variant?: "default" | "danger";
  "aria-label": string;
}

export function IconButton({ children, active, variant = "default", className, ...rest }: IconButtonProps) {
  const classes = [styles.iconButton, active && styles.active, variant === "danger" && styles.danger, className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} type="button" {...rest}>
      {children}
    </button>
  );
}
