import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  Divider,
  Slider,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  useStreamingUpload: DEFAULT_UPLOAD_CONFIG.useStreaming || true
};

interface AdvancedUploadSettingsProps {
  open: boolean;
  onClose: () => void;
  onSave: (settings: UploadSettings) => void;
  initialSettings: UploadSettings;
}

export const AdvancedUploadSettings: React.FC<AdvancedUploadSettingsProps> = ({
  open,
  onClose,
  onSave,
  initialSettings
}) => {
  const [settings, setSettings] = useState<UploadSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings
  });

  useEffect(() => {
    setSettings({
      ...DEFAULT_SETTINGS,
      ...initialSettings
    });
  }, [initialSettings]);

  const handleChange = (field: keyof UploadSettings) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.type === 'checkbox' 
      ? event.target.checked 
      : Number(event.target.value);
    
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSliderChange = (field: keyof UploadSettings) => (
    event: Event,
    newValue: number | number[]
  ) => {
    setSettings(prev => ({
      ...prev,
      [field]: newValue
    }));
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Advanced Upload Settings
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          تحسين إعدادات الرفع للملفات الكبيرة والاتصال البطيء
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">الإعدادات الأساسية</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  تحديد حجم الملفات التي تستخدم TUS (الرفع القابل للاستئناف)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography>100 MB</Typography>
                  <Slider
                    value={settings.useTusThresholdMB}
                    onChange={handleSliderChange('useTusThresholdMB')}
                    step={100}
                    min={100}
                    max={2000}
                    sx={{ mx: 2, flexGrow: 1 }}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value} MB`}
                  />
                  <Typography>2 GB</Typography>
                </Box>
                <Typography variant="caption" display="block" color="text.secondary">
                  استخدم TUS للملفات الأكبر من {settings.useTusThresholdMB} ميجابايت. الملفات الأصغر تستخدم الرفع التقليدي.
                </Typography>
              </Box>

              <TextField
                fullWidth
                label="حجم القطع (بالميجابايت)"
                type="number"
                value={settings.chunkSize / (1024 * 1024)}
                onChange={(e) => {
                  setSettings(prev => ({
                    ...prev,
                    chunkSize: Number(e.target.value) * 1024 * 1024
                  }));
                }}
                helperText="القطع الأكبر قد تكون أسرع ولكنها تستخدم المزيد من الذاكرة. الموصى به: 8-16 ميجابايت."
                sx={{ mb: 2 }}
                InputProps={{
                  inputProps: { min: 1, max: 50 }
                }}
              />

              <TextField
                fullWidth
                label="عدد الرفع المتزامن"
                type="number"
                value={settings.maxConcurrent}
                onChange={handleChange('maxConcurrent')}
                helperText="المزيد من عمليات الرفع المتزامنة قد تسرع الوقت الإجمالي ولكنها قد تبطئ الملفات الفردية."
                sx={{ mb: 2 }}
                InputProps={{
                  inputProps: { min: 1, max: 5 }
                }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.useStreaming}
                    onChange={handleChange('useStreaming')}
                  />
                }
                label="استخدام الرفع بالتدفق للملفات الصغيرة"
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
                الرفع بالتدفق عادة ما يكون أسرع ويستخدم ذاكرة أقل، خاصة للملفات الكبيرة. قم بتعطيله فقط إذا كنت تواجه مشكلات.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">إعدادات الاتصال والمحاولة</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                label="عدد محاولات إعادة الرفع"
                type="number"
                value={settings.retryAttempts}
                onChange={handleChange('retryAttempts')}
                helperText="عدد مرات المحاولة بعد فشل الاتصال"
                sx={{ mb: 2 }}
                InputProps={{
                  inputProps: { min: 1, max: 10 }
                }}
              />

              <TextField
                fullWidth
                label="مهلة الطلب (بالثواني)"
                type="number"
                value={settings.timeoutMs / 1000}
                onChange={(e) => {
                  setSettings(prev => ({
                    ...prev,
                    timeoutMs: Number(e.target.value) * 1000
                  }));
                }}
                helperText="المدة التي يستغرقها الطلب قبل اعتباره فاشلاً"
                sx={{ mb: 2 }}
                InputProps={{
                  inputProps: { min: 10, max: 300 }
                }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enableAutoRetry}
                    onChange={handleChange('enableAutoRetry')}
                  />
                }
                label="إعادة المحاولة تلقائياً عند انقطاع الاتصال"
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
                استأنف الرفع تلقائياً عند استعادة الاتصال بالإنترنت
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enableConnectionCheck}
                    onChange={handleChange('enableConnectionCheck')}
                  />
                }
                label="فحص حالة الاتصال قبل الرفع"
              />
              <Typography variant="caption" display="block" color="text.secondary">
                تأجيل بدء الرفع إذا لم يكن هناك اتصال بالإنترنت
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">إعدادات التخزين المؤقت والاستئناف</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enableResumableSessions}
                    onChange={handleChange('enableResumableSessions')}
                  />
                }
                label="تمكين تخزين جلسات الرفع"
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
                تخزين معلومات الرفع محليًا لاستئناف الرفع بعد إعادة تحميل الصفحة
              </Typography>

              <TextField
                fullWidth
                label="مدة صلاحية الجلسة (بالساعات)"
                type="number"
                value={settings.sessionExpiryHours}
                onChange={handleChange('sessionExpiryHours')}
                helperText="المدة التي يتم بعدها حذف معلومات الجلسة المخزنة"
                InputProps={{
                  inputProps: { min: 1, max: 168 }
                }}
              />
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} color="secondary">
          إعادة تعيين
        </Button>
        <Button onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          حفظ التغييرات
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 