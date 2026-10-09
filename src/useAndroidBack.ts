import { App as NativeApp } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useEffect, useRef } from "react";

/** Route Android's system back button through the same guarded modal close path. */
export function useAndroidBack(tab: string, onHome: () => void) {
  const current = useRef({ tab, onHome });
  current.current = { tab, onHome };
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    let listener: PluginListenerHandle | undefined;
    let disposed = false;
    void NativeApp.addListener("backButton", ({ canGoBack }) => {
      if (document.querySelector('[role="dialog"]')) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      } else if (current.current.tab !== "recipes") {
        current.current.onHome();
      } else if (canGoBack) {
        window.history.back();
      } else {
        void NativeApp.exitApp();
      }
    })
      .then((handle) => {
        if (disposed) void handle.remove();
        else listener = handle;
      })
      .catch((error: unknown) =>
        console.error("Unable to register Android back handler", error),
      );
    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, []);
}
