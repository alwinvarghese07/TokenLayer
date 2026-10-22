import type { TokenItem } from '../../shared/messages';

export interface TokenTreeNode {
  id: string; // unique hierarchical identifier, e.g. "neutral/blueGrayLight"
  name: string; // group display name, e.g. "blueGrayLight"
  fullPath: string; // full path string
  depth: number; // 0 for top nested group (neutral), 1 for subgroup (blueGrayLight), etc.
  directTokens: TokenItem[]; // tokens belonging directly to this group node
  children: TokenTreeNode[]; // nested subgroups
  totalCount: number; // sum of directTokens + all children recursive counts
}

export interface ParsedTokenPath {
  categoryName: string;
  categoryId: string;
  groupPath: string[]; // intermediate nested group names, e.g. ["neutral", "blueGrayLight"]
  variantName: string; // e.g. "0"
}

/**
 * Extracts the leaf variant name of a token (e.g. "0", "50", "primary").
 */
export function getVariantName(token: TokenItem): string {
  const cleanName = token.name.replace(/\\/g, '/').trim();
  const slashIdx = cleanName.lastIndexOf('/');
  if (slashIdx !== -1) {
    const leaf = cleanName.slice(slashIdx + 1).trim();
    if (leaf.length > 0) return leaf;
  }
  const dotIdx = cleanName.lastIndexOf('.');
  if (dotIdx !== -1) {
    const leaf = cleanName.slice(dotIdx + 1).trim();
    if (leaf.length > 0) return leaf;
  }
  return token.name;
}

/**
 * Parses a token's full name and resolved type to determine:
 * - Its top-level category (e.g. "Colors", "Spacing", "Typography")
 * - Its nested group path (e.g. ["neutral", "blueGrayLight"])
 * - Its leaf variant name (e.g. "0")
 */
export function parseTokenPath(token: TokenItem): ParsedTokenPath {
  const cleanName = token.name.replace(/\\/g, '/').trim();

  // Split path: prefer '/' if present, otherwise '.' if present
  let parts: string[];
  if (cleanName.includes('/')) {
    parts = cleanName.split('/').map((s) => s.trim()).filter((s) => s.length > 0);
  } else if (cleanName.includes('.')) {
    parts = cleanName.split('.').map((s) => s.trim()).filter((s) => s.length > 0);
  } else {
    parts = [cleanName];
  }

  let categoryName = 'General';
  let consumedP0 = false;

  if (parts.length > 1 && parts[0].length > 0) {
    const prefix = parts[0].toLowerCase();
    if (prefix.includes('color') || prefix.includes('colour')) {
      categoryName = 'Colors';
      consumedP0 = true;
    } else if (
      prefix.includes('space') ||
      prefix.includes('spacing') ||
      prefix.includes('gap') ||
      prefix.includes('size')
    ) {
      categoryName = 'Spacing';
      consumedP0 = true;
    } else if (
      prefix.includes('font') ||
      prefix.includes('type') ||
      prefix.includes('text') ||
      prefix.includes('line')
    ) {
      categoryName = 'Typography';
      consumedP0 = true;
    } else if (prefix.includes('radius') || prefix.includes('corner')) {
      categoryName = 'Radius';
      consumedP0 = true;
    } else if (prefix.includes('border') || prefix.includes('stroke')) {
      categoryName = 'Borders';
      consumedP0 = true;
    } else if (prefix.includes('elevation') || prefix.includes('shadow')) {
      categoryName = 'Shadows';
      consumedP0 = true;
    } else if (prefix.includes('bool') || prefix.includes('boolean')) {
      categoryName = 'Booleans';
      consumedP0 = true;
    }
  }

  // If first part was not consumed as a recognized category:
  if (!consumedP0) {
    switch (token.resolvedType) {
      case 'COLOR':
        categoryName = 'Colors';
        break;
      case 'FLOAT':
        categoryName = 'Spacing';
        break;
      case 'STRING':
        categoryName = 'Typography';
        break;
      case 'BOOLEAN':
        categoryName = 'Booleans';
        break;
      default:
        if (parts.length > 1) {
          categoryName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          consumedP0 = true;
        } else {
          categoryName = token.collectionName || 'Variables';
        }
        break;
    }
  }

  const categoryId = categoryName.toLowerCase();

  // Calculate remaining parts for the nested hierarchy
  const remainingParts = consumedP0 ? parts.slice(1) : parts;

  if (remainingParts.length === 0) {
    return {
      categoryName,
      categoryId,
      groupPath: [],
      variantName: parts[0] || token.name,
    };
  }

  // The last part is the leaf token variant name
  const variantName = remainingParts[remainingParts.length - 1];
  const groupPath = remainingParts.slice(0, -1);

  return {
    categoryName,
    categoryId,
    groupPath,
    variantName,
  };
}

interface InternalGroupNode {
  id: string;
  name: string;
  fullPath: string;
  depth: number;
  directTokens: TokenItem[];
  childrenMap: Map<string, InternalGroupNode>;
  order: number;
}

/**
 * Builds a deterministic tree of TokenTreeNode from a list of tokens.
 * Preserves source order of subgroups and variant tokens.
 */
export function buildTokenTree(tokens: TokenItem[]): TokenTreeNode[] {
  const rootChildrenMap = new Map<string, InternalGroupNode>();
  let nextOrder = 0;

  for (const token of tokens) {
    const { groupPath } = parseTokenPath(token);

    if (groupPath.length === 0) {
      // Direct tokens under root category without nested subgroups
      const directKey = '__direct__';
      if (!rootChildrenMap.has(directKey)) {
        rootChildrenMap.set(directKey, {
          id: directKey,
          name: '',
          fullPath: '',
          depth: 0,
          directTokens: [],
          childrenMap: new Map(),
          order: nextOrder++,
        });
      }
      rootChildrenMap.get(directKey)!.directTokens.push(token);
    } else {
      let currentMap = rootChildrenMap;
      let currentPath = '';
      let parentNode: InternalGroupNode | null = null;

      for (let i = 0; i < groupPath.length; i++) {
        const segment = groupPath[i];
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        if (!currentMap.has(segment)) {
          currentMap.set(segment, {
            id: currentPath,
            name: segment,
            fullPath: currentPath,
            depth: i,
            directTokens: [],
            childrenMap: new Map(),
            order: nextOrder++,
          });
        }

        const node = currentMap.get(segment)!;
        parentNode = node;
        currentMap = node.childrenMap;
      }

      if (parentNode) {
        parentNode.directTokens.push(token);
      }
    }
  }

  function convertNode(internal: InternalGroupNode): TokenTreeNode {
    const children = Array.from(internal.childrenMap.values())
      .sort((a, b) => a.order - b.order)
      .map(convertNode);

    const directCount = internal.directTokens.length;
    const childrenCount = children.reduce((acc, c) => acc + c.totalCount, 0);

    return {
      id: internal.id,
      name: internal.name,
      fullPath: internal.fullPath,
      depth: internal.depth,
      directTokens: internal.directTokens,
      children,
      totalCount: directCount + childrenCount,
    };
  }

  return Array.from(rootChildrenMap.values())
    .sort((a, b) => a.order - b.order)
    .map(convertNode);
}
