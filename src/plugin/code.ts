import type {
  UIMessage,
  PluginMessage,
  TokenCollection,
  TokenItem,
  TokenModeValue,
  TokenResolvedType,
  MigrationRecord,
  MigrationStatus,
} from '../shared/messages';

// Launch UI with spacious dimensions suitable for token browsing
figma.showUI(__html__, {
  width: 500,
  height: 700,
  themeColors: true,
});

function postToUI(msg: PluginMessage): void {
  figma.ui.postMessage(msg);
}

const MIGRATION_HISTORY_KEY = 'tokenlayer_migration_history_v1';

async function getStoredMigrationHistory(): Promise<MigrationRecord[]> {
  try {
    const data = await figma.clientStorage.getAsync(MIGRATION_HISTORY_KEY);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch (e) {
    console.warn('Failed to load migration history from clientStorage:', e);
    return [];
  }
}

async function saveMigrationHistory(records: MigrationRecord[]): Promise<void> {
  try {
    const capped = records.slice(0, 30);
    await figma.clientStorage.setAsync(MIGRATION_HISTORY_KEY, capped);
  } catch (e) {
    console.warn('Failed to save migration history to clientStorage:', e);
  }
}

async function upsertMigrationRecord(record: MigrationRecord): Promise<MigrationRecord[]> {
  const list = await getStoredMigrationHistory();
  const index = list.findIndex((r) => r.id === record.id);
  let updated: MigrationRecord[];
  if (index >= 0) {
    updated = [...list];
    updated[index] = { ...updated[index], ...record };
  } else {
    updated = [record, ...list];
  }
  const capped = updated.slice(0, 30);
  await saveMigrationHistory(capped);
  return capped;
}

function rgbToHex(r: number, g: number, b: number, a: number = 1): string {
  const toHex = (n: number) => {
    const val = Math.max(0, Math.min(255, Math.round(n * 255)));
    return val.toString(16).padStart(2, '0').toUpperCase();
  };
  const base = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a !== undefined && a < 0.999) {
    return `${base}${toHex(a)}`;
  }
  return base;
}

function formatColorRgba(r: number, g: number, b: number, a: number = 1): string {
  const round = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255)));
  const alpha = Math.round(a * 100) / 100;
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${alpha})`;
}

async function loadTokens(): Promise<void> {
  try {
    const [rawCollections, rawVariables] = await Promise.all([
      figma.variables.getLocalVariableCollectionsAsync(),
      figma.variables.getLocalVariablesAsync(),
    ]);

    // Build lookup maps for collections and variables to quickly resolve aliases
    const collectionMap = new Map<string, VariableCollection>();
    rawCollections.forEach((col) => collectionMap.set(col.id, col));

    const variableMap = new Map<string, Variable>();
    rawVariables.forEach((v) => variableMap.set(v.id, v));

    // Serialize collections
    const collections: TokenCollection[] = rawCollections.map((col) => ({
      id: col.id,
      name: col.name,
      defaultModeId: col.defaultModeId,
      modes: col.modes.map((m) => ({
        modeId: m.modeId,
        name: m.name,
      })),
      variableCount: col.variableIds.length,
    }));

    // Serialize tokens
    const tokens: TokenItem[] = [];

    for (const v of rawVariables) {
      const parentCol = collectionMap.get(v.variableCollectionId);
      const colName = parentCol ? parentCol.name : 'Unknown';
      const modesList = parentCol ? parentCol.modes : [];

      const valuesByMode: Record<string, TokenModeValue> = {};

      for (const mode of modesList) {
        const rawVal = v.valuesByMode[mode.modeId];
        let formattedValue = '';
        let isAlias = false;
        let aliasTargetName: string | undefined;
        let aliasTargetCollection: string | undefined;
        let colorHex: string | undefined;
        let colorRgba: string | undefined;
        let scalarVal: string | number | boolean = '';

        if (rawVal && typeof rawVal === 'object' && 'type' in rawVal && rawVal.type === 'VARIABLE_ALIAS') {
          isAlias = true;
          const targetVar = variableMap.get(rawVal.id) || (await figma.variables.getVariableByIdAsync(rawVal.id));
          if (targetVar) {
            aliasTargetName = targetVar.name;
            const targetCol = collectionMap.get(targetVar.variableCollectionId);
            aliasTargetCollection = targetCol?.name;
            formattedValue = `{${targetVar.name}}`;
            scalarVal = targetVar.name;

            // Resolve color if target or variable is a color
            if (v.resolvedType === 'COLOR' || targetVar.resolvedType === 'COLOR') {
              let currentTarget: Variable | null = targetVar;
              let currentVal = currentTarget.valuesByMode[mode.modeId] ?? Object.values(currentTarget.valuesByMode)[0];
              let depth = 0;
              while (currentVal && typeof currentVal === 'object' && 'type' in currentVal && currentVal.type === 'VARIABLE_ALIAS' && depth < 5) {
                depth++;
                currentTarget = variableMap.get(currentVal.id) || (await figma.variables.getVariableByIdAsync(currentVal.id));
                if (!currentTarget) break;
                currentVal = currentTarget.valuesByMode[mode.modeId] ?? Object.values(currentTarget.valuesByMode)[0];
              }
              if (currentVal && typeof currentVal === 'object' && 'r' in currentVal) {
                const r = (currentVal as RGBA).r ?? 0;
                const g = (currentVal as RGBA).g ?? 0;
                const b = (currentVal as RGBA).b ?? 0;
                const a = (currentVal as RGBA).a !== undefined ? (currentVal as RGBA).a : 1;
                colorHex = rgbToHex(r, g, b, a);
                colorRgba = formatColorRgba(r, g, b, a);
              }
            }
          } else {
            aliasTargetName = 'Unknown Variable';
            formattedValue = '{unknown}';
            scalarVal = rawVal.id;
          }
        } else if (v.resolvedType === 'COLOR' && rawVal && typeof rawVal === 'object' && 'r' in rawVal) {
          const r = (rawVal as RGBA).r ?? 0;
          const g = (rawVal as RGBA).g ?? 0;
          const b = (rawVal as RGBA).b ?? 0;
          const a = (rawVal as RGBA).a !== undefined ? (rawVal as RGBA).a : 1;
          colorHex = rgbToHex(r, g, b, a);
          colorRgba = formatColorRgba(r, g, b, a);
          formattedValue = colorHex;
          scalarVal = colorHex;
        } else if (typeof rawVal === 'number' || typeof rawVal === 'string' || typeof rawVal === 'boolean') {
          formattedValue = String(rawVal);
          scalarVal = rawVal;
        } else {
          formattedValue = rawVal ? JSON.stringify(rawVal) : 'null';
          scalarVal = formattedValue;
        }

        valuesByMode[mode.modeId] = {
          modeId: mode.modeId,
          modeName: mode.name,
          value: scalarVal,
          formattedValue,
          isAlias,
          aliasTargetName,
          aliasTargetCollection,
          colorHex,
          colorRgba,
        };
      }

      tokens.push({
        id: v.id,
        name: v.name,
        description: v.description || '',
        resolvedType: v.resolvedType as TokenResolvedType,
        collectionId: v.variableCollectionId,
        collectionName: colName,
        scopes: v.scopes as string[],
        valuesByMode,
      });
    }

    postToUI({
      type: 'TOKENS_LOADED',
      payload: {
        collections,
        tokens,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load tokens from document';
    postToUI({
      type: 'ERROR',
      payload: { message },
    });
  }
}

// Initial connection handshake
postToUI({
  type: 'PLUGIN_READY',
  payload: {
    documentName: figma.root.name,
  },
});

// Load tokens immediately on launch
loadTokens();

function hexToFigmaRgb(hex: string): RGBA {
  const clean = hex.replace('#', '').trim();
  let r = 0, g = 0, b = 0, a = 1;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) / 255;
    g = parseInt(clean[1] + clean[1], 16) / 255;
    b = parseInt(clean[2] + clean[2], 16) / 255;
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16) / 255;
    g = parseInt(clean.substring(2, 4), 16) / 255;
    b = parseInt(clean.substring(4, 6), 16) / 255;
  } else if (clean.length === 8) {
    r = parseInt(clean.substring(0, 2), 16) / 255;
    g = parseInt(clean.substring(2, 4), 16) / 255;
    b = parseInt(clean.substring(4, 6), 16) / 255;
    a = parseInt(clean.substring(6, 8), 16) / 255;
  }
  return { r, g, b, a };
}

function isVariableAlias(val: unknown): val is VariableAlias {
  return Boolean(
    val &&
      typeof val === 'object' &&
      'type' in val &&
      (val as { type: string }).type === 'VARIABLE_ALIAS' &&
      'id' in val &&
      typeof (val as { id: unknown }).id === 'string'
  );
}

function computeTargetName(
  sourceName: string,
  preserveNestedGroups: boolean,
  tokenNaming: string,
  sourceCollectionName: string
): string {
  const pathParts = sourceName
    .replace(/\\/g, '/')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const leafName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : sourceName;

  let targetName = preserveNestedGroups ? sourceName : leafName;
  if (tokenNaming === 'Prefix with collection') {
    targetName = `${sourceCollectionName}/${targetName}`;
  } else if (tokenNaming === 'Add v2 suffix') {
    targetName = `${targetName}-v2`;
  } else if (tokenNaming === 'Lowercase with hyphens') {
    targetName = targetName.toLowerCase().replace(/[/\\s]+/g, '-');
  }
  return targetName;
}

function extractVariableValueDisplay(
  rawVal: unknown,
  resolvedType: VariableResolvedDataType,
  allVars: Variable[],
  collections: VariableCollection[]
): {
  hex?: string;
  formatted: string;
  isAlias: boolean;
  aliasTargetId?: string;
  aliasTargetName?: string;
} {
  if (isVariableAlias(rawVal)) {
    const aliasId = rawVal.id;
    const targetVar = allVars.find((v) => v.id === aliasId);
    const targetName = targetVar ? targetVar.name : 'Unknown';
    let hex: string | undefined;

    if (targetVar && targetVar.resolvedType === 'COLOR') {
      const targetCol = collections.find((c) => c.id === targetVar.variableCollectionId);
      if (targetCol && targetCol.modes.length > 0) {
        const targetVal = targetVar.valuesByMode[targetCol.modes[0].modeId];
        if (targetVal && typeof targetVal === 'object' && 'r' in targetVal) {
          const r = (targetVal as RGBA).r ?? 0;
          const g = (targetVal as RGBA).g ?? 0;
          const b = (targetVal as RGBA).b ?? 0;
          const a = (targetVal as RGBA).a !== undefined ? (targetVal as RGBA).a : 1;
          hex = rgbToHex(r, g, b, a);
        }
      }
    }

    return {
      hex,
      formatted: `{${targetName}}`,
      isAlias: true,
      aliasTargetId: aliasId,
      aliasTargetName: targetVar?.name,
    };
  }

  if (resolvedType === 'COLOR' && rawVal && typeof rawVal === 'object' && 'r' in rawVal) {
    const r = (rawVal as RGBA).r ?? 0;
    const g = (rawVal as RGBA).g ?? 0;
    const b = (rawVal as RGBA).b ?? 0;
    const a = (rawVal as RGBA).a !== undefined ? (rawVal as RGBA).a : 1;
    const hex = rgbToHex(r, g, b, a);
    return {
      hex,
      formatted: hex,
      isAlias: false,
    };
  }

  if (typeof rawVal === 'number' || typeof rawVal === 'string' || typeof rawVal === 'boolean') {
    return {
      formatted: String(rawVal),
      isAlias: false,
    };
  }

  return {
    formatted: rawVal !== undefined && rawVal !== null ? String(rawVal) : '',
    isAlias: false,
  };
}

async function applyVariableValueForMode({
  targetVar,
  destModeId,
  sourceVal,
  resolvedType,
  srcCol,
  destCol,
  destVarMap,
  allVars,
  preserveNestedGroups,
  tokenNaming,
}: {
  targetVar: Variable;
  destModeId: string;
  sourceVal: unknown;
  resolvedType: VariableResolvedDataType;
  srcCol: VariableCollection;
  destCol: VariableCollection;
  destVarMap: Map<string, Variable>;
  allVars: Variable[];
  preserveNestedGroups: boolean;
  tokenNaming: string;
}): Promise<void> {
  if (isVariableAlias(sourceVal)) {
    const aliasId = sourceVal.id;
    let origTargetVar = allVars.find((v) => v.id === aliasId);
    if (!origTargetVar) {
      try {
        origTargetVar = (await figma.variables.getVariableByIdAsync(aliasId)) || undefined;
      } catch {
        // ignore
      }
    }

    if (!origTargetVar) {
      throw new Error(
        `Alias target variable (ID: ${aliasId}) was not found in the Figma document.`
      );
    }

    // Determine target variable in destination or document
    let targetToAlias: Variable | undefined;

    // 1. If the aliased variable was in the source collection, map to its counterpart in destination collection
    if (origTargetVar.variableCollectionId === srcCol.id) {
      const counterpartName = computeTargetName(
        origTargetVar.name,
        preserveNestedGroups,
        tokenNaming,
        srcCol.name
      );
      targetToAlias = destVarMap.get(counterpartName);
    }

    // 2. If not found via counterpart, check if destination collection already has a variable with the target's name
    if (!targetToAlias && origTargetVar.variableCollectionId !== destCol.id) {
      targetToAlias = destVarMap.get(origTargetVar.name);
    }

    // 3. If target was already in destCol
    if (!targetToAlias && origTargetVar.variableCollectionId === destCol.id) {
      targetToAlias = origTargetVar;
    }

    // 4. If still not found in destination, keep alias to the original variable (e.g. from a shared library / primitives collection)
    if (!targetToAlias) {
      targetToAlias = origTargetVar;
    }

    // Validate type compatibility
    if (targetToAlias.resolvedType !== resolvedType) {
      throw new Error(
        `Cannot alias "${targetVar.name}" (${resolvedType}) to "${targetToAlias.name}" (${targetToAlias.resolvedType}): incompatible variable types.`
      );
    }

    // Set variable alias using official Figma Plugin API
    const aliasObj = figma.variables.createVariableAlias(targetToAlias);
    targetVar.setValueForMode(destModeId, aliasObj);
    return;
  }

  // Primitive values
  if (resolvedType === 'COLOR') {
    if (sourceVal && typeof sourceVal === 'object' && 'r' in sourceVal) {
      targetVar.setValueForMode(destModeId, sourceVal as RGBA);
    } else if (typeof sourceVal === 'string' && sourceVal.startsWith('#')) {
      targetVar.setValueForMode(destModeId, hexToFigmaRgb(sourceVal));
    }
    return;
  }

  if (resolvedType === 'FLOAT') {
    const num = typeof sourceVal === 'number' ? sourceVal : parseFloat(String(sourceVal));
    if (!isNaN(num)) {
      targetVar.setValueForMode(destModeId, num);
    }
    return;
  }

  if (resolvedType === 'STRING') {
    targetVar.setValueForMode(destModeId, String(sourceVal ?? ''));
    return;
  }

  if (resolvedType === 'BOOLEAN') {
    targetVar.setValueForMode(destModeId, Boolean(sourceVal));
    return;
  }
}

figma.ui.onmessage = async (msg: UIMessage) => {
  if (!msg || typeof msg !== 'object') {
    return;
  }

  switch (msg.type) {
    case 'INIT': {
      postToUI({
        type: 'PLUGIN_READY',
        payload: {
          documentName: figma.root.name,
        },
      });
      try {
        const history = await getStoredMigrationHistory();
        postToUI({
          type: 'MIGRATION_HISTORY_LOADED',
          payload: { records: history },
        });
      } catch (err: unknown) {
        postToUI({
          type: 'MIGRATION_HISTORY_LOADED',
          payload: {
            records: [],
            error: err instanceof Error ? err.message : 'Could not load migration history',
          },
        });
      }
      await loadTokens();
      break;
    }

    case 'LOAD_TOKENS': {
      await loadTokens();
      break;
    }

    case 'GET_MIGRATION_HISTORY': {
      try {
        const history = await getStoredMigrationHistory();
        postToUI({
          type: 'MIGRATION_HISTORY_LOADED',
          payload: { records: history },
        });
      } catch (err: unknown) {
        postToUI({
          type: 'MIGRATION_HISTORY_LOADED',
          payload: {
            records: [],
            error: err instanceof Error ? err.message : 'Could not load migration history',
          },
        });
      }
      break;
    }

    case 'SAVE_MIGRATION_RECORD': {
      try {
        const updated = await upsertMigrationRecord(msg.payload);
        postToUI({
          type: 'MIGRATION_HISTORY_LOADED',
          payload: { records: updated },
        });
      } catch (err: unknown) {
        console.warn('Failed to save migration record:', err);
      }
      break;
    }

    case 'CLEAR_MIGRATION_HISTORY': {
      try {
        await figma.clientStorage.deleteAsync(MIGRATION_HISTORY_KEY);
        postToUI({
          type: 'MIGRATION_HISTORY_LOADED',
          payload: { records: [] },
        });
      } catch (err: unknown) {
        console.warn('Failed to clear migration history:', err);
      }
      break;
    }

    case 'CREATE_COLLECTION': {
      try {
        const { name, sourceCollectionId } = msg.payload;
        const trimmed = name.trim();
        const existingCols = await figma.variables.getLocalVariableCollectionsAsync();
        const dup = existingCols.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (dup) {
          postToUI({
            type: 'COLLECTION_CREATED',
            payload: {
              success: false,
              error: `A collection named "${trimmed}" already exists in this Figma file.`,
            },
          });
          break;
        }

        // Create the real variable collection in the Figma file!
        const newCol = figma.variables.createVariableCollection(trimmed);

        // Copy / setup modes if sourceCollectionId is provided
        if (sourceCollectionId) {
          const srcCol = existingCols.find((c) => c.id === sourceCollectionId);
          if (srcCol && srcCol.modes.length > 0) {
            // Rename first default mode
            newCol.renameMode(newCol.modes[0].modeId, srcCol.modes[0].name);
            // Add remaining modes
            for (let i = 1; i < srcCol.modes.length; i++) {
              newCol.addMode(srcCol.modes[i].name);
            }
          }
        }

        // Reload all tokens in the document so UI is fresh
        await loadTokens();

        postToUI({
          type: 'COLLECTION_CREATED',
          payload: {
            success: true,
            collection: {
              id: newCol.id,
              name: newCol.name,
              defaultModeId: newCol.defaultModeId,
              modes: newCol.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
              variableCount: 0,
            },
          },
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create collection in Figma.';
        postToUI({
          type: 'COLLECTION_CREATED',
          payload: {
            success: false,
            error: errorMsg,
          },
        });
      }
      break;
    }

    case 'EXECUTE_MIGRATION': {
      try {
        const {
          sourceCollectionId,
          destinationCollectionId,
          destinationName,
          preserveNestedGroups,
          tokenNaming,
          nameConflicts,
          tokenIds,
        } = msg.payload;

        const allCols = await figma.variables.getLocalVariableCollectionsAsync();
        const allVars = await figma.variables.getLocalVariablesAsync();

        // 1. Resolve source collection
        const srcCol = allCols.find((c) => c.id === sourceCollectionId);
        if (!srcCol) {
          throw new Error('Source collection not found in document.');
        }

        // 2. Resolve or create destination collection in Figma
        let destCol: VariableCollection | undefined;
        if (destinationCollectionId) {
          destCol = allCols.find((c) => c.id === destinationCollectionId);
        }
        if (!destCol) {
          destCol = allCols.find(
            (c) => c.name.toLowerCase() === destinationName.trim().toLowerCase()
          );
        }
        if (!destCol) {
          // Create real collection in Figma!
          destCol = figma.variables.createVariableCollection(destinationName.trim());
        }

        // 3. Ensure modes exist in destination collection matching source collection
        const srcModes = srcCol.modes;
        const destModes = destCol.modes;

        // If destCol was just created and has only default mode, rename it to match source first mode
        if (
          destModes.length === 1 &&
          srcModes.length > 0 &&
          destModes[0].name !== srcModes[0].name
        ) {
          destCol.renameMode(destModes[0].modeId, srcModes[0].name);
        }

        // Add any missing modes from source into destination
        for (const sMode of srcModes) {
          const hasMode = destCol.modes.some(
            (dm) => dm.name.toLowerCase() === sMode.name.toLowerCase()
          );
          if (!hasMode) {
            try {
              destCol.addMode(sMode.name);
            } catch (e) {
              console.warn('Could not add mode to collection in Figma', e);
            }
          }
        }

        // Build mode mapping by name: srcModeId -> destModeId
        const modeIdMap = new Map<string, string>();
        for (const sMode of srcCol.modes) {
          const matchedDestMode =
            destCol.modes.find((dm) => dm.name.toLowerCase() === sMode.name.toLowerCase()) ||
            destCol.modes[0];
          if (matchedDestMode) {
            modeIdMap.set(sMode.modeId, matchedDestMode.modeId);
          }
        }

        // 4. Map of existing variables in destination collection
        const existingDestVars = allVars.filter((v) => v.variableCollectionId === destCol!.id);
        const destVarMap = new Map<string, Variable>();
        existingDestVars.forEach((v) => destVarMap.set(v.name, v));

        // 5. Source variables to migrate
        const varsToMigrate = allVars.filter((v) => tokenIds.includes(v.id));

        const results: Array<{
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
        }> = [];

        interface PlannedOp {
          type: 'OVERWRITE' | 'CREATE';
          sourceVar: Variable;
          targetVar: Variable;
          targetName: string;
          leafName: string;
          groupPath: string;
          isNew: boolean;
          sourceHex?: string;
          destHex?: string;
          sourceValue?: string;
          destValue?: string;
        }

        const plannedOps: PlannedOp[] = [];

        // PASS 1: Identify existing tokens, handle conflict policies, and instantiate/resolve target variables
        for (const v of varsToMigrate) {
          const pathParts = v.name
            .replace(/\\/g, '/')
            .split('/')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          const leafName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : v.name;
          const groupPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

          let targetName = computeTargetName(
            v.name,
            preserveNestedGroups,
            tokenNaming,
            srcCol.name
          );

          // Read primary source value representation
          const firstSrcMode = srcCol.modes[0];
          const rawSrcVal = v.valuesByMode[firstSrcMode.modeId];
          const srcDisplay = extractVariableValueDisplay(
            rawSrcVal,
            v.resolvedType,
            allVars,
            allCols
          );

          const existingVar = destVarMap.get(targetName);

          if (existingVar) {
            // Read primary destination value representation
            const firstDestMode = destCol.modes[0];
            const rawDestVal = existingVar.valuesByMode[firstDestMode.modeId];
            const destDisplay = extractVariableValueDisplay(
              rawDestVal,
              existingVar.resolvedType,
              allVars,
              allCols
            );

            // Incompatible variable types cannot be overwritten or merged
            if (existingVar.resolvedType !== v.resolvedType) {
              results.push({
                id: v.id,
                name: targetName,
                leafName,
                groupPath,
                resolvedType: v.resolvedType as TokenResolvedType,
                status: 'SKIPPED',
                detail: `Destination variable "${targetName}" already exists with incompatible type "${existingVar.resolvedType}" (source is "${v.resolvedType}").`,
                sourceHex: srcDisplay.hex,
                destHex: destDisplay.hex,
                sourceValue: srcDisplay.formatted,
                destValue: destDisplay.formatted || destDisplay.hex,
              });
              continue;
            }

            const isIdentical =
              (srcDisplay.hex &&
                destDisplay.hex &&
                srcDisplay.hex.toUpperCase() === destDisplay.hex.toUpperCase()) ||
              (srcDisplay.formatted &&
                destDisplay.formatted &&
                srcDisplay.formatted === destDisplay.formatted);

            if (nameConflicts === 'Skip existing tokens') {
              let skipReason = '';
              if (srcCol.id === destCol.id) {
                skipReason = `Variable "${targetName}" already exists in the destination collection (source and destination are the same collection: "${destCol.name}").`;
              } else if (isIdentical) {
                skipReason = `Variable "${targetName}" already exists in "${destCol.name}" with identical value (${destDisplay.formatted || destDisplay.hex}). Skipped as no change is required.`;
              } else {
                skipReason = `Variable "${targetName}" already exists in "${destCol.name}" with value ${destDisplay.formatted || destDisplay.hex} (source is ${srcDisplay.formatted || srcDisplay.hex}). Skipped because Name Conflicts is set to "Skip existing tokens".`;
              }

              results.push({
                id: v.id,
                name: targetName,
                leafName,
                groupPath,
                resolvedType: v.resolvedType as TokenResolvedType,
                status: 'SKIPPED',
                detail: skipReason,
                sourceHex: srcDisplay.hex,
                destHex: destDisplay.hex,
                sourceValue: srcDisplay.formatted,
                destValue: destDisplay.formatted || destDisplay.hex,
              });
              continue;
            } else if (nameConflicts === 'Overwrite existing') {
              plannedOps.push({
                type: 'OVERWRITE',
                sourceVar: v,
                targetVar: existingVar,
                targetName,
                leafName,
                groupPath,
                isNew: false,
                sourceHex: srcDisplay.hex,
                destHex: destDisplay.hex,
                sourceValue: srcDisplay.formatted,
                destValue: destDisplay.formatted || destDisplay.hex,
              });
              continue;
            } else if (nameConflicts === 'Rename with suffix') {
              let counter = 1;
              let suffixedName = `${targetName}-${counter}`;
              while (destVarMap.has(suffixedName)) {
                counter++;
                suffixedName = `${targetName}-${counter}`;
              }
              targetName = suffixedName;
            }
          }

          // Create variable in destination collection
          try {
            const newVar = figma.variables.createVariable(
              targetName,
              destCol,
              v.resolvedType as VariableResolvedDataType
            );
            if (v.description) {
              newVar.description = v.description;
            }
            destVarMap.set(targetName, newVar);

            plannedOps.push({
              type: 'CREATE',
              sourceVar: v,
              targetVar: newVar,
              targetName,
              leafName,
              groupPath,
              isNew: true,
              sourceHex: srcDisplay.hex,
              sourceValue: srcDisplay.formatted,
            });
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : 'Figma API error creating variable';
            results.push({
              id: v.id,
              name: targetName,
              leafName,
              groupPath,
              resolvedType: v.resolvedType as TokenResolvedType,
              status: 'FAILED',
              detail: 'Failed to create variable in Figma',
              errorReason: errMsg,
              sourceHex: srcDisplay.hex,
              sourceValue: srcDisplay.formatted,
            });
          }
        }

        // PASS 2: Apply mode values and resolve aliases now that all destination variables are registered
        for (const op of plannedOps) {
          try {
            for (const sMode of srcCol.modes) {
              const dModeId = modeIdMap.get(sMode.modeId);
              if (!dModeId) continue;
              const sVal = op.sourceVar.valuesByMode[sMode.modeId];

              await applyVariableValueForMode({
                targetVar: op.targetVar,
                destModeId: dModeId,
                sourceVal: sVal,
                resolvedType: op.sourceVar.resolvedType as VariableResolvedDataType,
                srcCol,
                destCol,
                destVarMap,
                allVars,
                preserveNestedGroups,
                tokenNaming,
              });
            }

            results.push({
              id: op.sourceVar.id,
              name: op.targetName,
              leafName: op.leafName,
              groupPath: op.groupPath,
              resolvedType: op.sourceVar.resolvedType as TokenResolvedType,
              status: op.type === 'OVERWRITE' ? 'UPDATED' : 'SUCCESSFUL',
              detail:
                op.type === 'OVERWRITE'
                  ? 'Updated existing variable in destination'
                  : `Created in ${destCol.name}`,
              sourceHex: op.sourceHex,
              destHex: op.destHex,
              sourceValue: op.sourceValue,
              destValue: op.destValue,
            });
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : 'Error setting variable values';
            // If creation of values failed for a newly created variable, remove it to prevent corrupt tokens
            if (op.isNew) {
              try {
                op.targetVar.remove();
                destVarMap.delete(op.targetName);
              } catch {
                // ignore
              }
            }

            results.push({
              id: op.sourceVar.id,
              name: op.targetName,
              leafName: op.leafName,
              groupPath: op.groupPath,
              resolvedType: op.sourceVar.resolvedType as TokenResolvedType,
              status: 'FAILED',
              detail: `Failed to migrate variable "${op.sourceVar.name}"`,
              errorReason: errMsg,
              sourceHex: op.sourceHex,
              sourceValue: op.sourceValue,
            });
          }
        }

        // Calculate summary metrics
        const successful = results.filter((r) => r.status === 'SUCCESSFUL').length;
        const updated = results.filter((r) => r.status === 'UPDATED').length;
        const skipped = results.filter((r) => r.status === 'SKIPPED').length;
        const failed = results.filter((r) => r.status === 'FAILED').length;
        const total = results.length;

        let status: MigrationStatus = 'COMPLETED';
        if (failed > 0) {
          status = failed === total && total > 0 ? 'FAILED' : 'NEEDS_ATTENTION';
        }

        // Persist completed migration record to clientStorage
        if (msg.payload.migrationId) {
          try {
            await upsertMigrationRecord({
              id: msg.payload.migrationId,
              sourceCollectionId: srcCol.id,
              sourceCollectionName: srcCol.name,
              destinationCollectionId: destCol.id,
              destinationCollectionName: destCol.name,
              status,
              startedAt: Date.now(),
              completedAt: Date.now(),
              summary: { total, successful, updated, skipped, failed },
              results,
            });
            const updatedHistory = await getStoredMigrationHistory();
            postToUI({
              type: 'MIGRATION_HISTORY_LOADED',
              payload: { records: updatedHistory },
            });
          } catch (storageErr) {
            console.warn('Failed to persist migration record to clientStorage:', storageErr);
          }
        }

        // Reload all tokens in the document so the new collection and variables appear everywhere in TokenLayer!
        await loadTokens();

        postToUI({
          type: 'MIGRATION_RESULT',
          payload: {
            migrationId: msg.payload.migrationId,
            success: true,
            sourceCollectionName: srcCol.name,
            destinationCollectionName: destCol.name,
            results,
          },
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Migration failed.';

        if (msg.payload.migrationId) {
          try {
            await upsertMigrationRecord({
              id: msg.payload.migrationId,
              sourceCollectionName: 'Source',
              destinationCollectionName: msg.payload.destinationName || 'Destination',
              status: 'FAILED',
              startedAt: Date.now(),
              completedAt: Date.now(),
              errorMessage: errorMsg,
              results: [
                {
                  id: 'err-figma',
                  name: 'Migration Error',
                  leafName: 'Error',
                  groupPath: 'Figma API',
                  resolvedType: 'STRING',
                  status: 'FAILED',
                  detail: errorMsg,
                  errorReason: errorMsg,
                },
              ],
            });
            const updatedHistory = await getStoredMigrationHistory();
            postToUI({
              type: 'MIGRATION_HISTORY_LOADED',
              payload: { records: updatedHistory },
            });
          } catch (storageErr) {
            console.warn('Failed to persist failed migration record to clientStorage:', storageErr);
          }
        }

        postToUI({
          type: 'MIGRATION_RESULT',
          payload: {
            migrationId: msg.payload.migrationId,
            success: false,
            sourceCollectionName: 'Source',
            destinationCollectionName: 'Destination',
            results: [],
            error: errorMsg,
          },
        });
      }
      break;
    }

    case 'NOTIFY': {
      figma.notify(msg.message);
      break;
    }

    case 'RESIZE': {
      const width = Math.max(340, Math.min(1000, Math.round(msg.width)));
      const height = Math.max(460, Math.min(1200, Math.round(msg.height)));
      figma.ui.resize(width, height);
      break;
    }

    case 'CLOSE_PLUGIN': {
      figma.closePlugin();
      break;
    }

    default:
      break;
  }
};
