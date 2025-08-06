import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Check, X, LinkIcon } from 'lucide-react';
import { sheetConfigManager, type SheetConfig } from '@/lib/sheet-config/sheet-config-manager';
import { useToast } from '@/hooks/use-toast';

interface SheetConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: SheetConfig) => void;
  existingConfigs: SheetConfig[];
  editingConfig?: SheetConfig | null;
}

export function SheetConfigDialog({ 
  open, 
  onClose, 
  onSave, 
  existingConfigs,
  editingConfig = null 
}: SheetConfigDialogProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<Partial<SheetConfig>>({
    name: '',
    spreadsheetId: '',
    sheetName: 'OPERATIONS',
    nameColumn: 'A',
    embedColumn: 'B',
    finalMinutesColumn: 'C',
    isDefault: false
  });
  
  const [errors, setErrors] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);

  // تحديث الحقول عند فتح الحوار للتعديل
  useEffect(() => {
    if (editingConfig) {
      setConfig(editingConfig);
      setUrlInput(`https://docs.google.com/spreadsheets/d/${editingConfig.spreadsheetId}/edit`);
    } else {
      // إعادة تعيين القيم للإضافة الجديدة
      setConfig({
        name: '',
        spreadsheetId: '',
        sheetName: 'OPERATIONS',
        nameColumn: 'A',
        embedColumn: 'B',
        finalMinutesColumn: 'C',
        isDefault: existingConfigs.length === 0
      });
      setUrlInput('');
    }
    setErrors([]);
  }, [editingConfig, existingConfigs, open]);

  const handleUrlChange = (value: string) => {
    setUrlInput(value);
    
    if (value.trim()) {
      setIsValidatingUrl(true);
      
      // استخراج معرف الشيت من الرابط
      setTimeout(() => {
        const extractedId = sheetConfigManager.extractSpreadsheetId(value);
        if (extractedId) {
          setConfig(prev => ({ ...prev, spreadsheetId: extractedId }));
          setErrors([]);
        } else {
          setErrors(['رابط أو معرف الشيت غير صحيح']);
        }
        setIsValidatingUrl(false);
      }, 500);
    } else {
      setConfig(prev => ({ ...prev, spreadsheetId: '' }));
      setErrors([]);
    }
  };

  const handleSave = () => {
    // التحقق من صحة البيانات
    const validationErrors = sheetConfigManager.validateConfig(config);
    
    // التحقق من عدم تكرار الاسم (إلا في حالة التعديل)
    const nameExists = existingConfigs.some(c => 
      c.name === config.name && (!editingConfig || c.id !== editingConfig.id)
    );
    if (nameExists) {
      validationErrors.push('اسم الإعداد موجود بالفعل');
    }

    // التحقق من عدم تكرار معرف الشيت (إلا في حالة التعديل)
    const idExists = existingConfigs.some(c => 
      c.spreadsheetId === config.spreadsheetId && (!editingConfig || c.id !== editingConfig.id)
    );
    if (idExists) {
      validationErrors.push('هذا الشيت مضاف بالفعل');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      let savedConfig: SheetConfig;

      if (editingConfig) {
        // تحديث الإعداد الموجود
        const updated = sheetConfigManager.updateConfig(editingConfig.id, config);
        if (updated) {
          savedConfig = sheetConfigManager.getConfigById(editingConfig.id)!;
          toast({
            title: "✅ تم التحديث بنجاح",
            description: `تم تحديث إعدادات "${config.name}" بنجاح`,
            variant: "default"
          });
        } else {
          throw new Error('فشل في تحديث الإعداد');
        }
      } else {
        // إضافة إعداد جديد
        savedConfig = sheetConfigManager.addConfig(config as Omit<SheetConfig, 'id' | 'createdAt' | 'updatedAt'>);
        toast({
          title: "✅ تم الحفظ بنجاح",
          description: `تم إضافة إعدادات الشيت "${config.name}" بنجاح`,
          variant: "default"
        });
      }

      onSave(savedConfig);
      onClose();
    } catch (error) {
      console.error('Error saving sheet config:', error);
      setErrors(['حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى']);
      
      toast({
        title: "❌ خطأ في الحفظ",
        description: "حدث خطأ أثناء حفظ الإعدادات",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setConfig({
      name: '',
      spreadsheetId: '',
      sheetName: 'OPERATIONS',
      nameColumn: 'A',
      embedColumn: 'B',
      finalMinutesColumn: 'C',
      isDefault: false
    });
    setUrlInput('');
    setErrors([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            {editingConfig ? 'تعديل إعدادات الشيت' : 'إضافة شيت جديد'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* عرض الأخطاء */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-red-800 font-medium">يرجى تصحيح الأخطاء التالية:</p>
                  <ul className="text-red-700 text-sm space-y-1">
                    {errors.map((error, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <X className="w-3 h-3" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* اسم الإعداد */}
          <div className="space-y-2">
            <Label htmlFor="config-name">اسم الإعداد *</Label>
            <Input
              id="config-name"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
              placeholder="مثال: شيت المراجعات، شيت العملاء، إلخ..."
              className="text-right"
            />
            <p className="text-sm text-gray-500">
              اختر اسماً وصفياً لتتمكن من التمييز بين الشيتات المختلفة
            </p>
          </div>

          {/* رابط أو معرف الشيت */}
          <div className="space-y-2">
            <Label htmlFor="sheet-url">رابط Google Sheet أو معرف الشيت *</Label>
            <div className="relative">
              <Input
                id="sheet-url"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... أو معرف الشيت مباشرة"
                className="text-left"
                dir="ltr"
              />
              {isValidatingUrl && (
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
              {config.spreadsheetId && !isValidatingUrl && (
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              الصق رابط الشيت الكامل أو معرف الشيت فقط
            </p>
            {config.spreadsheetId && (
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <p className="text-sm text-green-800">
                  <strong>معرف الشيت:</strong> <code className="bg-white px-1 rounded">{config.spreadsheetId}</code>
                </p>
              </div>
            )}
          </div>

          {/* اسم الورقة */}
          <div className="space-y-2">
            <Label htmlFor="sheet-name">اسم الورقة (Tab) *</Label>
            <Input
              id="sheet-name"
              value={config.sheetName}
              onChange={(e) => setConfig(prev => ({ ...prev, sheetName: e.target.value }))}
              placeholder="OPERATIONS"
              className="text-right"
            />
            <p className="text-sm text-gray-500">
              اسم الورقة داخل ملف Google Sheet (يظهر في التبويبات أسفل الشيت)
            </p>
          </div>

          {/* إعدادات الأعمدة */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">
              إعدادات الأعمدة
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="video-name-column">عمود أسماء الفيديوهات *</Label>
                <Input
                  id="video-name-column"
                  value={config.nameColumn}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    nameColumn: e.target.value.toUpperCase() 
                  }))}
                  placeholder="A"
                  className="text-center font-mono"
                  maxLength={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="embed-code-column">عمود كود الإيمبيد *</Label>
                <Input
                  id="embed-code-column"
                  value={config.embedCodeColumn}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    embedCodeColumn: e.target.value.toUpperCase() 
                  }))}
                  placeholder="B"
                  className="text-center font-mono"
                  maxLength={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="final-minutes-column">عمود الدقائق النهائية *</Label>
                <Input
                  id="final-minutes-column"
                  value={config.finalMinutesColumn}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    finalMinutesColumn: e.target.value.toUpperCase() 
                  }))}
                  placeholder="C"
                  className="text-center font-mono"
                  maxLength={3}
                />
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>ملاحظة:</strong> استخدم أحرف الأعمدة في Excel/Google Sheets (A, B, C, D, ... , AA, AB, إلخ)
              </p>
            </div>
          </div>

          {/* جعل هذا الشيت افتراضي */}
          <div className="flex items-center space-x-2 space-x-reverse">
            <Switch
              id="is-default"
              checked={config.isDefault || false}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, isDefault: checked }))}
            />
            <Label htmlFor="is-default" className="text-sm">
              جعل هذا الشيت الافتراضي
            </Label>
          </div>
          {config.isDefault && (
            <p className="text-sm text-amber-600">
              ⚠️ سيتم استخدام هذا الشيت تلقائياً عند رفع الفيديوهات الجديدة
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            type="button"
          >
            إلغاء
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!config.name || !config.spreadsheetId || !config.sheetName}
            type="button"
          >
            {editingConfig ? 'تحديث' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
