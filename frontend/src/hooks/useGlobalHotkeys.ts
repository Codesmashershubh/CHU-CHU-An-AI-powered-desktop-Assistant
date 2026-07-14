import { useEffect } from "react";
import { useChuChuStore } from "@/lib/store";

export function useGlobalHotkeys(): void {
  const commandPaletteOpen = useChuChuStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useChuChuStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isModK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isModK) {
        event.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
        return;
      }
      if (event.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);
}
