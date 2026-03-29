import React from "react";

const DOUBLE_CLICK_NAVIGATION_SUPPRESSION_MS = 520;
const SINGLE_CLICK_NAVIGATE_DELAY_MS = 220;

interface MenuAnchorPosition {
  left: number;
  top: number;
}

interface UseKanbanCardInteractionOptions {
  disabled?: boolean;
  onNavigate?: (() => void) | undefined;
  shouldOpenMenuOnDoubleClick?: (() => boolean) | undefined;
}

export function useKanbanCardInteraction(
  options: UseKanbanCardInteractionOptions,
) {
  const [menuAnchor, setMenuAnchor] = React.useState<MenuAnchorPosition | null>(null);
  const pendingNavigateTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressSingleClickNavigationUntilRef = React.useRef<number>(0);

  function clearPendingNavigateTimeout(): void {
    if (pendingNavigateTimeoutRef.current === null) {
      return;
    }

    clearTimeout(pendingNavigateTimeoutRef.current);
    pendingNavigateTimeoutRef.current = null;
  }

  function scheduleSingleClickNavigation(): void {
    if (options.disabled || options.onNavigate === undefined) {
      return;
    }

    clearPendingNavigateTimeout();

    if (menuAnchor !== null) {
      return;
    }

    if (Date.now() < suppressSingleClickNavigationUntilRef.current) {
      return;
    }

    pendingNavigateTimeoutRef.current = setTimeout(() => {
      pendingNavigateTimeoutRef.current = null;
      options.onNavigate?.();
    }, SINGLE_CLICK_NAVIGATE_DELAY_MS);
  }

  React.useEffect(() => () => {
    clearPendingNavigateTimeout();
  }, []);

  function closeMenu(): void {
    setMenuAnchor(null);
    suppressSingleClickNavigationUntilRef.current = Math.max(
      suppressSingleClickNavigationUntilRef.current,
      Date.now() + DOUBLE_CLICK_NAVIGATION_SUPPRESSION_MS,
    );
    clearPendingNavigateTimeout();
  }

  function handleClick(): void {
    scheduleSingleClickNavigation();
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLElement>): void {
    event.preventDefault();
    clearPendingNavigateTimeout();

    if (options.disabled) {
      return;
    }

    suppressSingleClickNavigationUntilRef.current =
      Date.now() + DOUBLE_CLICK_NAVIGATION_SUPPRESSION_MS;

    if (!options.shouldOpenMenuOnDoubleClick?.()) {
      return;
    }

    setMenuAnchor({
      left: event.clientX,
      top: event.clientY,
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    if (options.disabled) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    scheduleSingleClickNavigation();
  }

  return {
    closeMenu,
    handleClick,
    handleDoubleClick,
    handleKeyDown,
    menuAnchor,
  };
}
