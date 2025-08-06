export interface ParsedFilename {
  type: 'RE' | 'QV' | 'FULL';
  academicYear: string; // e.g., "S1", "M2"
  term?: string; // e.g., "T1", "T2"
  unit?: string; // e.g., "U2"
  lesson?: string; // e.g., "L1"
  branch?: string; // e.g., "AR", "EN"
  secondaryBranch?: string; // For cases like SCI-AR where both occur
  hasBranchConflict?: boolean; // Flag for AR-SCI conflicts
  mathType?: 'PURE' | 'APPLIED'; // e.g., PURE or APPLIED math
  teacherCode?: string; // e.g., "P0046"
  teacherName?: string; // e.g., "Zakaria Seif Eldin"
  class?: string; // e.g., "C30"
  arabicText?: string; // Text within curly braces
  collection?: string; // Optional collection hint from embedded metadata
  startsWithRE?: boolean; // Flag if filename starts with RE
  endsWithQNumber?: boolean; // Flag if filename ends with Q<number>
  originalFilename?: string; // The original filename for additional pattern matching
}

export interface LibraryInfo {
  id: string;
  name: string;
}

export interface LibraryMatch {
  library: LibraryInfo | null;
  confidence: number;
  alternatives: LibraryInfo[];
}

export interface CollectionResult {
  name: string;
  reason: string;
}

export interface ParseResult {
  filename: string;
  parsed: ParsedFilename | null;
  libraryMatch: LibraryMatch;
  collection: CollectionResult;
  unmatchedGroup?: string;
  error?: string;
}

export interface CollectionConfig {
  name: string;
  pattern: RegExp;
  prefix?: string;
  priority?: number;
}

export const COLLECTIONS_CONFIG: { [year: string]: CollectionConfig[] } = {
  "2023": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2024": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2025": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2026": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2027": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2028": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2029": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2030": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2031": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2032": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ],
  "2033": [
    {
      name: "RE",
      pattern: /^RE-/i,
      priority: 1
    },
    {
      name: "QV",
      pattern: /[Q]\d+$/i,
      priority: 2
    }
  ]
};

// This can be used for validation if needed
export const VALID_COLLECTIONS = ["T1", "T2", "RE", "QV"] as const;
