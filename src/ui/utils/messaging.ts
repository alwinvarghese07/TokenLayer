import { useEffect } from 'react';
import type { UIMessage, PluginMessage, FigmaPluginEvent } from '../../shared/messages';

/**
 * Sends a typed message to the Figma plugin runtime.
 */
export function postToPlugin(message: UIMessage): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

/**
 * React hook to listen for typed messages sent by the Figma plugin runtime.
 */
export function usePluginMessage(callback: (msg: PluginMessage) => void): void {
  useEffect(() => {
    const handleMessage = (event: MessageEvent<FigmaPluginEvent['data']>) => {
      const pluginMessage = event.data?.pluginMessage;
      if (pluginMessage && typeof pluginMessage === 'object' && 'type' in pluginMessage) {
        callback(pluginMessage);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [callback]);
}
