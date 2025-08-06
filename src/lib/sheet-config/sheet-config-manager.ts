interface SheetConfig {
  id: string;
  name: string;
  spreadsheetId: string;
  sheetName: string;
  nameColumn: string; // Primary canonical field
  embedColumn: string;
  finalMinutesColumn: string;
  // Added legacy/alias fields for backward compatibility with existing components
  videoNameColumn?: string;
  embedCodeColumn?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// PRESET SHEET CONFIGS – تُضاف تلقائياً عند أول تشغيل (أو إذا لم تُوجد أصلاً)
// ---------------------------------------------------------------------------

const PRESET_CONFIGS: Omit<SheetConfig, 'createdAt' | 'updatedAt' | 'id'>[] = [
  {
    name: 'شيت 2025',
    spreadsheetId: '1ohaHyfkJFQ0vdiu5ewjdgULXrBurHIhNP4orZJmaRO8',
    sheetName: 'OPERATIONS',
    nameColumn: 'N',
    embedColumn: 'W',
    finalMinutesColumn: 'Q',
    videoNameColumn: 'N',
    embedCodeColumn: 'W',
    isDefault: false
  },
  {
    name: 'شيت 2026',
    spreadsheetId: '1Hm7noXxv8ITMU3dNXQmqFEzfZY1mZlBJ4bQ9_ZIR0-M',
    sheetName: 'OPERATIONS',
    nameColumn: 'M',
    embedColumn: 'Q',
    finalMinutesColumn: 'P',
    videoNameColumn: 'M',
    embedCodeColumn: 'Q',
    isDefault: true // الافتراضى المبدئى
  }
];

// Helper لإنشاء SheetConfig كامل من الإعداد المسبق
function buildPreset(base: Omit<SheetConfig, 'createdAt' | 'updatedAt' | 'id'>): SheetConfig {
  return {
    ...base,
    id: `preset_${base.spreadsheetId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// (تم نقل ثابت PRESET_CONFIGS والدالة buildPreset إلى مستوى خارجى أعلى الملف)

class SheetConfigManager {
  private readonly STORAGE_KEY = 'sheet_configurations';
  private configs: SheetConfig[] = [];
  private initialized = false;

  constructor() {
    try {
      this.loadConfigs();
      this.initialized = true;
    } catch (error) {
      console.error('[SheetConfigManager] Initialization failed:', error);
      // Initialize with default configs if loading fails
      this.configs = PRESET_CONFIGS.map(buildPreset);
      this.initialized = true;
    }
  }

  private loadConfigs(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        try {
          // Ensure backward-compatibility by mapping old field names to new aliases (and vice-versa)
          const parsed: SheetConfig[] = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.configs = parsed.map((cfg) => ({
              ...cfg,
              // Inject aliases if missing so the rest of the codebase (which expects videoNameColumn/embedCodeColumn) keeps working
              videoNameColumn: cfg.videoNameColumn ?? cfg.nameColumn,
              embedCodeColumn: cfg.embedCodeColumn ?? cfg.embedColumn,
              // Ensure canonical fields exist too
              nameColumn: cfg.nameColumn ?? cfg.videoNameColumn,
              embedColumn: cfg.embedColumn ?? cfg.embedCodeColumn,
            }));

            // 🔄 دمج الإعدادات المسبقة إذا كانت غير موجودة
            for (const presetBase of PRESET_CONFIGS) {
              const exists = this.configs.some(c => c.spreadsheetId === presetBase.spreadsheetId);
              if (!exists) {
                this.configs.push(buildPreset(presetBase));
              }
            }

            // إذا لم يكن هناك أى شيت محدد كافتراضى، اجعل أول واحد isDefault
            if (!this.configs.some(c => c.isDefault)) {
              const defaultPreset = this.configs.find(c => c.spreadsheetId === PRESET_CONFIGS.find(p => p.isDefault)?.spreadsheetId) || this.configs[0];
              if (defaultPreset) defaultPreset.isDefault = true;
            }

            console.log('[SheetConfigManager] Loaded configs from localStorage:', this.configs.length);
          } else {
            throw new Error('Stored configs is not an array');
          }
        } catch (parseError) {
          console.error('[SheetConfigManager] Error parsing stored configs:', parseError);
          // Fall back to preset configs
          this.configs = PRESET_CONFIGS.map(buildPreset);
          this.saveConfigs();
        }
      } else {
        // لا يوجد مخزن محلى → ابدأ بالإعدادات المسبقة
        this.configs = PRESET_CONFIGS.map(buildPreset);
        // تأكد من حفظها حتى تظهر فى المرات القادمة
        this.saveConfigs();
      }
    } catch (error) {
      console.error('[SheetConfigManager] Error loading configs:', error);
      // Initialize with preset configs as fallback
      this.configs = PRESET_CONFIGS.map(buildPreset);
      this.saveConfigs();
    }
  }

  private addDefaultConfig(): void {
    // محاولة قراءة الإعدادات من متغيرات البيئة
    const envSpreadsheetId = import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || '';
    const envSheetName = import.meta.env.VITE_GOOGLE_SHEET_NAME || 'OPERATIONS';

    if (envSpreadsheetId) {
      const defaultConfig: SheetConfig = {
        id: 'default',
        name: 'الشيت الافتراضي',
        spreadsheetId: envSpreadsheetId,
        sheetName: envSheetName,
        nameColumn: 'A',
        embedColumn: 'B',
        finalMinutesColumn: 'C',
        // Populate alias fields
        videoNameColumn: 'A',
        embedCodeColumn: 'B',
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.configs = [defaultConfig];
      this.saveConfigs();
      console.log('[SheetConfigManager] Created default config from environment variables');
    } else {
      console.warn('[SheetConfigManager] No environment variables found for default sheet config');
    }
  }

  private saveConfigs(): void {
    try {
      if (this.initialized) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.configs));
        console.log('[SheetConfigManager] Saved configs to localStorage');
      }
    } catch (error) {
      console.error('[SheetConfigManager] Error saving configs:', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  addConfig(config: Omit<SheetConfig, 'id' | 'createdAt' | 'updatedAt'>): SheetConfig {
    const newConfig: SheetConfig = {
      ...config,
      // Make sure aliases/canonical fields exist to keep rest of the app consistent
      nameColumn: (config as any).nameColumn ?? (config as any).videoNameColumn,
      embedColumn: (config as any).embedColumn ?? (config as any).embedCodeColumn,
      videoNameColumn: (config as any).videoNameColumn ?? (config as any).nameColumn,
      embedCodeColumn: (config as any).embedCodeColumn ?? (config as any).embedColumn,
      id: `sheet_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // إذا كان هذا أول شيت، اجعله افتراضي
    if (this.configs.length === 0) {
      newConfig.isDefault = true;
    }

    // إذا كان الشيت الجديد افتراضي، قم بإلغاء الافتراضية من الباقي
    if (newConfig.isDefault) {
      this.configs.forEach(c => c.isDefault = false);
    }

    this.configs.push(newConfig);
    this.saveConfigs();
    
    console.log('[SheetConfigManager] Added new config:', newConfig.name);
    return newConfig;
  }

  updateConfig(id: string, updates: Partial<SheetConfig>): boolean {
    const index = this.configs.findIndex(c => c.id === id);
    if (index !== -1) {
      // إذا كان التحديث يجعل هذا الشيت افتراضي، قم بإلغاء الافتراضية من الباقي
      if (updates.isDefault) {
        this.configs.forEach(c => c.isDefault = false);
      }

      this.configs[index] = { 
        ...this.configs[index], 
        ...updates, 
        updatedAt: new Date().toISOString() 
      };
      this.saveConfigs();
      
      console.log('[SheetConfigManager] Updated config:', id);
      return true;
    }
    return false;
  }

  deleteConfig(id: string): boolean {
    const index = this.configs.findIndex(c => c.id === id);
    if (index !== -1) {
      const wasDefault = this.configs[index].isDefault;
      this.configs.splice(index, 1);
      
      // إذا تم حذف الافتراضي، اجعل الأول افتراضي
      if (wasDefault && this.configs.length > 0) {
        this.configs[0].isDefault = true;
      }
      
      this.saveConfigs();
      console.log('[SheetConfigManager] Deleted config:', id);
      return true;
    }
    return false;
  }

  setDefault(id: string): boolean {
    const config = this.configs.find(c => c.id === id);
    if (config) {
      this.configs.forEach(c => c.isDefault = false);
      config.isDefault = true;
      config.updatedAt = new Date().toISOString();
      this.saveConfigs();
      
      console.log('[SheetConfigManager] Set default config:', id);
      return true;
    }
    return false;
  }

  getConfigs(): SheetConfig[] {
    return [...this.configs];
  }

  getDefaultConfig(): SheetConfig | null {
    return this.configs.find(c => c.isDefault) || this.configs[0] || null;
  }

  getConfigById(id: string): SheetConfig | null {
    return this.configs.find(c => c.id === id) || null;
  }

  // دالة مساعدة للتحقق من صحة الإعدادات
  validateConfig(config: Partial<SheetConfig>): string[] {
    const errors: string[] = [];

    if (!config.name?.trim()) {
      errors.push('اسم الإعداد مطلوب');
    }

    if (!config.spreadsheetId?.trim()) {
      errors.push('معرف الشيت مطلوب');
    }

    if (!config.sheetName?.trim()) {
      errors.push('اسم الورقة مطلوب');
    }

    if (!config.nameColumn?.trim()) {
      errors.push('عمود اسم الفيديو مطلوب');
    }

    if (!config.embedColumn?.trim()) {
      errors.push('عمود كود الإيمبيد مطلوب');
    }

    if (!config.finalMinutesColumn?.trim()) {
      errors.push('عمود الدقائق النهائية مطلوب');
    }

    // التحقق من صيغة الأعمدة
    const columnRegex = /^[A-Z]+$/;
    if (config.nameColumn && !columnRegex.test(config.nameColumn)) {
      errors.push('عمود اسم الفيديو يجب أن يكون أحرف إنجليزية كبيرة فقط (مثل: A, B, AA)');
    }

    if (config.embedColumn && !columnRegex.test(config.embedColumn)) {
      errors.push('عمود كود الإيمبيد يجب أن يكون أحرف إنجليزية كبيرة فقط (مثل: A, B, AA)');
    }

    if (config.finalMinutesColumn && !columnRegex.test(config.finalMinutesColumn)) {
      errors.push('عمود الدقائق النهائية يجب أن يكون أحرف إنجليزية كبيرة فقط (مثل: A, B, AA)');
    }

    return errors;
  }

  // دالة لاستخراج معرف الشيت من الرابط
  extractSpreadsheetId(url: string): string | null {
    try {
      // مطابقة أنماط مختلفة من روابط Google Sheets
      const patterns = [
        /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
        /\/d\/([a-zA-Z0-9-_]+)/,
        /spreadsheets\/d\/([a-zA-Z0-9-_]+)/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return match[1];
        }
      }

      // إذا كان النص معرف مباشر (لا يحتوي على رابط)
      if (/^[a-zA-Z0-9-_]+$/.test(url.trim())) {
        return url.trim();
      }

      return null;
    } catch (error) {
      console.error('Error extracting spreadsheet ID:', error);
      return null;
    }
  }
}

export const sheetConfigManager = new SheetConfigManager();
export type { SheetConfig };
