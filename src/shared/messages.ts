/**
 * Typed message protocol for TokenLayer.
 */

export type TokenResolvedType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface TokenModeValue {
  modeId: string;
  modeName: string;
  value: string | number | boolean;
  formattedValue: string;
  isAlias: boolean;
  aliasTargetName?: string;
  aliasTargetCollection?: string;
  colorHex?: string;
  colorRgba?: string;
}

export interface TokenItem {
  id: string;
  name: string;
  description: string;
  resolvedType: TokenResolvedType;
  collectionId: string;
  collectionName: string;
  scopes: string[];
  valuesByMode: Record<string, TokenModeValue>;
}

export interface TokenCollection {
  id: string;
  name: string;
  defaultModeId: string;
  modes: Array<{
    modeId: string;
    name: string;
  }>;
  variableCount: number;
}

// Messages sent from UI -> Plugin Runtime
export type UIMessage =
  | { type: 'INIT' }
  | { type: 'LOAD_TOKENS' }
  | { type: 'RESIZE'; width: number; height: number }
  | { type: 'NOTIFY'; message: string }
  | { type: 'CLOSE_PLUGIN' }
  | {
      type: 'CREATE_COLLECTION';
      payload: {
        name: string;
        description?: string;
        sourceCollectionId?: string;
      };
    }
  | {
      type: 'EXECUTE_MIGRATION';
      payload: {
        sourceCollectionId: string;
        destinationCollectionId?: string;
        destinationName: string;
        preserveNestedGroups: boolean;
        tokenNaming: string;
        nameConflicts: string;
        tokenIds: string[];
      };
    };

// Messages sent from Plugin Runtime -> UI
export type PluginMessage =
  | {
      type: 'PLUGIN_READY';
      payload: {
        userName?: string;
        documentName?: string;
      };
    }
  | {
      type: 'TOKENS_LOADED';
      payload: {
        collections: TokenCollection[];
        tokens: TokenItem[];
      };
    }
  | {
      type: 'COLLECTION_CREATED';
      payload: {
        success: boolean;
        collection?: TokenCollection;
        error?: string;
      };
    }
  | {
      type: 'MIGRATION_RESULT';
      payload: {
        success: boolean;
        sourceCollectionName: string;
        destinationCollectionName: string;
        results: Array<{
          id: string;
          name: string;
          leafName: string;
          groupPath: string;
          resolvedType: TokenResolvedType;
          status: 'SUCCESSFUL' | 'UPDATED' | 'SKIPPED' | 'FAILED';
          detail: string;
          sourceHex?: string;
          destHex?: string;
          sourceValue?: string;
          destValue?: string;
          errorReason?: string;
        }>;
        error?: string;
      };
    }
  | {
      type: 'ERROR';
      payload: {
        message: string;
      };
    };

/**
 * Standard window message event structure from Figma plugin iframe.
 */
export interface FigmaPluginEvent {
  data: {
    pluginMessage?: PluginMessage;
    pluginId?: string;
  };
}
