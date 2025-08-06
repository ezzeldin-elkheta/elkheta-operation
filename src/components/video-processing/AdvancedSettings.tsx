import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Settings } from 'lucide-react';
import { UploadSettings } from '../../lib/upload/types';
import { DEFAULT_UPLOAD_CONFIG } from '../../types/bunny';

// إعدادات افتراضية متوافقة مع UploadSettings
const DEFAULT_SETTINGS: UploadSettings = {
  maxConcurrentUploads: DEFAULT_UPLOAD_CONFIG.maxConcurrent || 3,
  useStreaming: DEFAULT_UPLOAD_CONFIG.useStreaming || true,
  chunkSize: DEFAULT_UPLOAD_CONFIG.chunkSize || 8 * 1024 * 1024,
  timeoutMs: DEFAULT_UPLOAD_CONFIG.timeoutMs || 30000,
  useTusThresholdMB: DEFAULT_UPLOAD_CONFIG.useTusThresholdMB || 1024,
  retryDelays: DEFAULT_UPLOAD_CONFIG.retryDelays || [0, 3000, 5000, 10000, 20000, 60000],
  retryAttempts: DEFAULT_UPLOAD_CONFIG.retryAttempts || 3,
  enableResumableSessions: DEFAULT_UPLOAD_CONFIG.enableResumableSessions || true,
  sessionExpiryHours: DEFAULT_UPLOAD_CONFIG.sessionExpiryHours || 24,
  enableAutoRetry: DEFAULT_UPLOAD_CONFIG.enableAutoRetry || true,
  enableConnectionCheck: DEFAULT_UPLOAD_CONFIG.enableConnectionCheck || true,
  maxConcurrent: DEFAULT_UPLOAD_CONFIG.maxConcurrent || 3,
  useStreamingUpload: DEFAULT_UPLOAD_CONFIG.useStreaming || true,
  uploadMethod: 'auto', // Add a default value with the correct type
  maxDirectUploadSizeMB: 100,
  enableAutoFallback: true
};

interface AdvancedSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: any;
  onSettingsChange: (settings: any) => void;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  open,
  onOpenChange,
  settings,
  onSettingsChange
}) => {
  const [localSettings, setLocalSettings] = useState<UploadSettings>({
    ...DEFAULT_SETTINGS,
    ...settings
  });

  useEffect(() => {
    setLocalSettings({
      ...DEFAULT_SETTINGS,
      ...settings
    });
  }, [settings]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleInputChange = (field: keyof UploadSettings) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.type === 'checkbox' 
      ? event.target.checked 
      : Number(event.target.value);
    
    setLocalSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSliderChange = (field: keyof UploadSettings) => (
    value: number[]
  ) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: value[0]
    }));
  };

  const handleSwitchChange = (field: keyof UploadSettings) => (
    checked: boolean
  ) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: checked
    }));
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  const handleSave = () => {
    // ضمان التوافق مع الواجهة القديمة
    const compatSettings = {
      ...localSettings,
      maxConcurrentUploads: localSettings.maxConcurrent || localSettings.maxConcurrentUploads,
      useStreamingUpload: localSettings.useStreaming || localSettings.useStreamingUpload,
      chunkSize: localSettings.chunkSize || 8 * 1024 * 1024
    };
    
    onSettingsChange(compatSettings);
    handleClose();
  };

  // المساعدة في تحويل القيمة إلى MB للعرض
  const toMB = (bytes: number) => bytes / (1024 * 1024);
  const toBytes = (mb: number) => mb * 1024 * 1024;

  // Update the method that's causing the type error
  const handleUploadMethodChange = (value: string) => {
    // Ensure the value is one of the allowed types
    const validMethod = (value === 'auto' || value === 'tus' || 
                       value === 'chunked' || value === 'direct') 
                       ? value as 'auto' | 'tus' | 'chunked' | 'direct' 
                       : 'auto';
    
    setLocalSettings(prev => ({
      ...prev,
      uploadMethod: validMethod
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>إعدادات الرفع المتقدمة</DialogTitle>
          <DialogDescription>
            تحسين إعدادات الرفع للملفات الكبيرة والاتصال البطيء
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="basic">
              <AccordionTrigger>الإعدادات الأساسية</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>حجم الملفات التي تستخدم TUS (الرفع القابل للاستئناف)</Label>
                    <div className="flex items-center space-x-2">
                      <span>100 MB</span>
                      <Slider 
                        value={[localSettings.useTusThresholdMB]} 
                        min={100} 
                        max={2000} 
                        step={100}
                        onValueChange={handleSliderChange('useTusThresholdMB')}
                      />
                      <span>2 GB</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      استخدم TUS للملفات الأكبر من {localSettings.useTusThresholdMB} ميجابايت
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="chunkSize">حجم القطع (بالميجابايت)</Label>
                    <Input 
                      id="chunkSize"
                      type="number" 
                      min={1}
                      max={50}
                      value={toMB(localSettings.chunkSize)}
                      onChange={(e) => {
                        setLocalSettings(prev => ({
                          ...prev,
                          chunkSize: toBytes(Number(e.target.value))
                        }));
                      }}
                    />
                    <p className="text-sm text-gray-500">
                      الموصى به: 8-16 ميجابايت
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxConcurrent">عدد الرفع المتزامن</Label>
                    <Input 
                      id="maxConcurrent"
                      type="number" 
                      min={1}
                      max={5}
                      value={localSettings.maxConcurrent}
                      onChange={(e) => {
                        setLocalSettings(prev => ({
                          ...prev,
                          maxConcurrent: Number(e.target.value)
                        }));
                      }}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="useStreaming"
                      checked={localSettings.useStreaming}
                      onCheckedChange={handleSwitchChange('useStreaming')}
                    />
                    <Label htmlFor="useStreaming">استخدام الرفع بالتدفق للملفات الصغيرة</Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="upload-method">
              <AccordionTrigger>طريقة الرفع للملفات الكبيرة</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>ملاحظة:</strong> إذا كنت تواجه مشاكل في رفع الملفات الكبيرة، جرب تغيير هذه الإعدادات
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>طريقة الرفع المفضلة للملفات الكبيرة</Label>
                    <select 
                      className="w-full p-2 border rounded"
                      value={localSettings.uploadMethod || 'auto'}
                      onChange={(e) => handleUploadMethodChange(e.target.value)}
                    >
                      <option value="auto">تلقائي (الموصى به)</option>
                      <option value="tus">TUS Protocol (للملفات الكبيرة جداً)</option>
                      <option value="chunked">رفع مجزأ (بديل عند فشل TUS)</option>
                      <option value="direct">رفع مباشر (للاتصال السريع فقط)</option>
                    </select>
                    <p className="text-sm text-gray-500">
                      {localSettings.uploadMethod === 'tus' && 'استخدام بروتوكول TUS القابل للاستئناف - الأفضل للملفات الكبيرة'}
                      {localSettings.uploadMethod === 'chunked' && 'رفع الملف على دفعات صغيرة - جيد للاتصال الضعيف'}
                      {localSettings.uploadMethod === 'direct' && 'رفع الملف بالكامل مرة واحدة - يتطلب اتصال مستقر'}
                      {(!localSettings.uploadMethod || localSettings.uploadMethod === 'auto') && 'النظام سيختار أفضل طريقة حسب حجم الملف وسرعة الاتصال'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize">أقصى حجم للرفع المباشر (بالميجابايت)</Label>
                    <Input 
                      id="maxFileSize"
                      type="number" 
                      min={10}
                      max={1000}
                      value={localSettings.maxDirectUploadSizeMB || 100}
                      onChange={(e) => {
                        setLocalSettings(prev => ({
                          ...prev,
                          maxDirectUploadSizeMB: Number(e.target.value)
                        }));
                      }}
                    />
                    <p className="text-sm text-gray-500">
                      الملفات الأكبر من هذا الحجم ستستخدم طريقة رفع متقدمة
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoFallback"
                      checked={localSettings.enableAutoFallback !== false}
                      onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, enableAutoFallback: checked }))}
                    />
                    <Label htmlFor="autoFallback">التبديل التلقائي عند فشل طريقة الرفع</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>نصائح لحل مشاكل الرفع:</Label>
                    <div className="bg-gray-50 p-3 rounded text-sm space-y-2">
                      <p>• إذا فشل الرفع عند 90%+، جرب تقليل حجم القطع</p>
                      <p>• إذا انقطع الرفع كثيراً، فعّل "مراقبة حالة الاتصال"</p>
                      <p>• للملفات الكبيرة جداً (+1GB)، استخدم TUS Protocol</p>
                      <p>• إذا كان الاتصال بطيء، قلل عدد الرفع المتزامن إلى 1</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="connection">
              <AccordionTrigger>إعدادات الاتصال والمحاولة</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="retryAttempts">عدد محاولات إعادة الرفع</Label>
                    <Input 
                      id="retryAttempts"
                      type="number" 
                      min={1}
                      max={10}
                      value={localSettings.retryAttempts}
                      onChange={(e) => {
                        setLocalSettings(prev => ({
                          ...prev,
                          retryAttempts: Number(e.target.value)
                        }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeoutMs">مهلة الطلب (بالثواني)</Label>
                    <Input 
                      id="timeoutMs"
                      type="number" 
                      min={10}
                      max={300}
                      value={localSettings.timeoutMs / 1000}
                      onChange={(e) => {
                        setLocalSettings(prev => ({
                          ...prev,
                          timeoutMs: Number(e.target.value) * 1000
                        }));
                      }}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableAutoRetry"
                      checked={localSettings.enableAutoRetry}
                      onCheckedChange={handleSwitchChange('enableAutoRetry')}
                    />
                    <Label htmlFor="enableAutoRetry">إعادة المحاولة تلقائياً عند انقطاع الاتصال</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableConnectionCheck"
                      checked={localSettings.enableConnectionCheck}
                      onCheckedChange={handleSwitchChange('enableConnectionCheck')}
                    />
                    <Label htmlFor="enableConnectionCheck">فحص حالة الاتصال قبل الرفع</Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="storage">
              <AccordionTrigger>إعدادات التخزين المؤقت والاستئناف</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableResumableSessions"
                      checked={localSettings.enableResumableSessions}
                      onCheckedChange={handleSwitchChange('enableResumableSessions')}
                    />
                    <Label htmlFor="enableResumableSessions">تمكين تخزين جلسات الرفع</Label>
                  </div>
                  <p className="text-sm text-gray-500">
                    تخزين معلومات الرفع محليًا لاستئناف الرفع بعد إعادة تحميل الصفحة
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="sessionExpiryHours">مدة صلاحية الجلسة (بالساعات)</Label>
                    <Input 
                      id="sessionExpiryHours"
                      type="number" 
                      min={1}
                      max={168}
                      value={localSettings.sessionExpiryHours}
                      onChange={(e) => {
                        setLocalSettings(prev => ({
                          ...prev,
                          sessionExpiryHours: Number(e.target.value)
                        }));
                      }}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
       
        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            إعادة تعيين
          </Button>
          <Button variant="outline" onClick={handleClose}>
            إلغاء
          </Button>
          <Button onClick={handleSave}>
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AdvancedSettings;
