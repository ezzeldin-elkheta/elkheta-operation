import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Settings, 
  Edit2, 
  Trash2, 
  Star, 
  MoreVertical, 
  Plus,
  Sheet,
  ExternalLink 
} from 'lucide-react';
import { sheetConfigManager, type SheetConfig } from '@/lib/sheet-config/sheet-config-manager';
import { useToast } from '@/hooks/use-toast';
import { SheetConfigDialog } from './SheetConfigDialog';

interface SheetConfigSelectorProps {
  configs: SheetConfig[];
  selectedId: string;
  onSelectionChange: (configId: string) => void;
  onConfigsUpdate: (configs: SheetConfig[]) => void;
}

export function SheetConfigSelector({ 
  configs, 
  selectedId, 
  onSelectionChange, 
  onConfigsUpdate 
}: SheetConfigSelectorProps) {
  const { toast } = useToast();
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SheetConfig | null>(null);

  const selectedConfig = configs.find(c => c.id === selectedId);

  const handleAddNew = () => {
    setEditingConfig(null);
    setShowConfigDialog(true);
  };

  const handleEdit = (config: SheetConfig) => {
    setEditingConfig(config);
    setShowConfigDialog(true);
  };

  const handleDelete = (config: SheetConfig) => {
    if (configs.length <= 1) {
      toast({
        title: "⚠️ لا يمكن الحذف",
        description: "يجب أن يكون هناك شيت واحد على الأقل",
        variant: "destructive"
      });
      return;
    }

    if (window.confirm(`هل أنت متأكد من حذف إعدادات "${config.name}"؟`)) {
      const success = sheetConfigManager.deleteConfig(config.id);
      if (success) {
        const updatedConfigs = sheetConfigManager.getConfigs();
        onConfigsUpdate(updatedConfigs);
        
        // إذا كان الشيت المحذوف مختاراً، اختر الافتراضي
        if (selectedId === config.id) {
          const defaultConfig = sheetConfigManager.getDefaultConfig();
          if (defaultConfig) {
            onSelectionChange(defaultConfig.id);
          }
        }

        toast({
          title: "✅ تم الحذف",
          description: `تم حذف إعدادات "${config.name}" بنجاح`,
          variant: "default"
        });
      }
    }
  };

  const handleSetDefault = (config: SheetConfig) => {
    const success = sheetConfigManager.setDefault(config.id);
    if (success) {
      const updatedConfigs = sheetConfigManager.getConfigs();
      onConfigsUpdate(updatedConfigs);
      onSelectionChange(config.id);

      toast({
        title: "✅ تم التحديث",
        description: `تم جعل "${config.name}" الشيت الافتراضي`,
        variant: "default"
      });
    }
  };

  const handleConfigSave = (savedConfig: SheetConfig) => {
    const updatedConfigs = sheetConfigManager.getConfigs();
    onConfigsUpdate(updatedConfigs);
    
    // اختيار الشيت المحفوظ
    onSelectionChange(savedConfig.id);
  };

  const openSheetInNewTab = (config: SheetConfig) => {
    const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sheet className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-gray-700">الشيت المحدد:</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddNew}
          className="gap-2 text-xs"
        >
          <Plus className="w-3 h-3" />
          إضافة شيت
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedId} onValueChange={onSelectionChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="اختر الشيت">
              {selectedConfig && (
                <div className="flex items-center gap-2">
                  <span>{selectedConfig.name}</span>
                  {selectedConfig.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      افتراضي
                    </Badge>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {configs.map((config) => (
              <SelectItem key={config.id} value={config.id}>
                <div className="flex items-center gap-2 w-full">
                  <span className="flex-1">{config.name}</span>
                  {config.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      افتراضي
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedConfig && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => openSheetInNewTab(selectedConfig)}>
                <ExternalLink className="w-4 h-4 mr-2" />
                فتح الشيت
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => handleEdit(selectedConfig)}>
                <Edit2 className="w-4 h-4 mr-2" />
                تعديل
              </DropdownMenuItem>
              
              {!selectedConfig.isDefault && (
                <DropdownMenuItem onClick={() => handleSetDefault(selectedConfig)}>
                  <Star className="w-4 h-4 mr-2" />
                  جعل افتراضي
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => handleDelete(selectedConfig)}
                className="text-red-600 focus:text-red-600"
                disabled={configs.length <= 1}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* معلومات الشيت المختار */}
      {selectedConfig && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">إعدادات الشيت الحالي:</span>
            <Badge variant="outline" className="text-xs">
              {selectedConfig.sheetName}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
            <div>
              <span className="block font-medium">أسماء الفيديوهات:</span>
              <code className="bg-white px-1 rounded">عمود {selectedConfig.videoNameColumn}</code>
            </div>
            <div>
              <span className="block font-medium">كود الإيمبيد:</span>
              <code className="bg-white px-1 rounded">عمود {selectedConfig.embedCodeColumn}</code>
            </div>
            <div>
              <span className="block font-medium">الدقائق النهائية:</span>
              <code className="bg-white px-1 rounded">عمود {selectedConfig.finalMinutesColumn}</code>
            </div>
          </div>
        </div>
      )}

      {/* Dialog لإضافة/تعديل الإعدادات */}
      <SheetConfigDialog
        open={showConfigDialog}
        onClose={() => {
          setShowConfigDialog(false);
          setEditingConfig(null);
        }}
        onSave={handleConfigSave}
        existingConfigs={configs}
        editingConfig={editingConfig}
      />
    </div>
  );
}
