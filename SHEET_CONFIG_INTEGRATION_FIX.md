# إصلاح تكامل Sheet Config مع API Routes

## المشكلة

كانت API routes تستخدم Environment Variables فقط، بينما الواجهة الأمامية تستخدم Sheet Config المحفوظ في localStorage. هذا أدى إلى عدم تطابق بين إعدادات الشيت المحددة من قبل المستخدم والإعدادات المستخدمة في API.

## البيانات المحفوظة في localStorage

```javascript
[
  {
    name: "شيت 2025",
    spreadsheetId: "1ohaHyfkJFQ0vdiu5ewjdgULXrBurHIhNP4orZJmaRO8",
    sheetName: "OPERATIONS",
    nameColumn: "N",
    embedCodeColumn: "W",
    finalMinutesColumn: "Q",
    isDefault: false
  },
  {
    name: "شيت 2026", 
    spreadsheetId: "1Hm7noXxv8ITMU3dNXQmqFEzfZY1mZlBJ4bQ9_ZIR0-M",
    sheetName: "OPERATIONS",
    nameColumn: "M",
    embedCodeColumn: "Q",
    finalMinutesColumn: "P",
    isDefault: true
  }
]
```

## الإصلاح المطبق

### 1. إصلاح Update Sheet Request

#### قبل الإصلاح:
```javascript
body: JSON.stringify({ 
  videos: embedUpdates,
  // البيانات كانت تُرسل مباشرة
  ...(getCurrentSheetConfig?.() && {
    spreadsheetId: getCurrentSheetConfig().spreadsheetId,
    sheetName: getCurrentSheetConfig().sheetName,
    nameColumn: getCurrentSheetConfig().videoNameColumn,
    embedColumn: getCurrentSheetConfig().embedCodeColumn,
    finalMinutesColumn: getCurrentSheetConfig().finalMinutesColumn
  })
})
```

#### بعد الإصلاح:
```javascript
body: JSON.stringify({ 
  videos: embedUpdates,
  // البيانات تُرسل في sheetConfig object
  sheetConfig: getCurrentSheetConfig?.() ? {
    spreadsheetId: getCurrentSheetConfig().spreadsheetId,
    sheetName: getCurrentSheetConfig().sheetName,
    nameColumn: getCurrentSheetConfig().videoNameColumn,
    embedColumn: getCurrentSheetConfig().embedCodeColumn,
    finalMinutesColumn: getCurrentSheetConfig().finalMinutesColumn
  } : undefined
})
```

### 2. إصلاح Final Minutes Update Request

#### قبل الإصلاح:
```javascript
body: JSON.stringify({ 
  videos: videoUpdates,
  // البيانات كانت تُرسل مباشرة
  ...(getCurrentSheetConfig?.() && {
    spreadsheetId: getCurrentSheetConfig().spreadsheetId,
    sheetName: getCurrentSheetConfig().sheetName,
    nameColumn: getCurrentSheetConfig().videoNameColumn,
    embedColumn: getCurrentSheetConfig().embedCodeColumn,
    finalMinutesColumn: getCurrentSheetConfig().finalMinutesColumn
  })
})
```

#### بعد الإصلاح:
```javascript
body: JSON.stringify({ 
  videos: videoUpdates,
  // البيانات تُرسل كمعاملات منفصلة
  spreadsheetId: getCurrentSheetConfig?.()?.spreadsheetId,
  sheetName: getCurrentSheetConfig?.()?.sheetName,
  nameColumn: getCurrentSheetConfig?.()?.videoNameColumn,
  finalMinutesColumn: getCurrentSheetConfig?.()?.finalMinutesColumn
})
```

## كيف يعمل الآن

### 1. اختيار الشيت من الواجهة
- المستخدم يختار شيت من القائمة المنسدلة
- البيانات تُحفظ في localStorage
- يتم تحديد الشيت الافتراضي

### 2. إرسال البيانات إلى API
- عند ضغط "Update Sheet" أو "Update Final Minutes"
- يتم قراءة Sheet Config الحالي من localStorage
- يتم إرسال البيانات مع الطلب إلى API

### 3. معالجة البيانات في API
- API route يقرأ Sheet Config من request body
- يستخدم الإعدادات المخصصة بدلاً من Environment Variables
- يطبق التحديثات على الشيت المحدد

## النتائج المتوقعة

### ✅ **Update Sheet**:
- يستخدم الشيت المحدد من الواجهة
- يستخدم الأعمدة المخصصة (M, Q, P)
- يحدث Embed Codes في العمود الصحيح

### ✅ **Update Final Minutes**:
- يستخدم الشيت المحدد من الواجهة  
- يستخدم الأعمدة المخصصة
- يحدث Final Minutes في العمود الصحيح

### ✅ **Sheet Config Management**:
- يمكن إضافة شيتات جديدة
- يمكن تغيير الإعدادات
- يتم حفظ الإعدادات في localStorage

## اختبار الإصلاح

### 1. اختبار Update Sheet:
1. اختر شيت مختلف من القائمة
2. حدد فيديوهات
3. اضغط "Update Sheet"
4. تأكد من التحديث في الشيت الصحيح

### 2. اختبار Final Minutes:
1. اختر شيت مختلف من القائمة
2. حدد فيديوهات
3. اضغط "Update Final Minutes"
4. تأكد من التحديث في العمود الصحيح

### 3. اختبار Sheet Config:
1. أضف شيت جديد
2. غيّر إعدادات الأعمدة
3. احفظ الإعدادات
4. اختبر التحديث مع الإعدادات الجديدة

## ملاحظات مهمة

### 1. **Fallback إلى Environment Variables**:
إذا لم يتم تحديد Sheet Config، سيعود API إلى استخدام Environment Variables كاحتياطي.

### 2. **Validation**:
API route يتحقق من صحة البيانات المُرسلة قبل استخدامها.

### 3. **Logging**:
تم إضافة logging مفصل لتتبع البيانات المُرسلة والمستلمة.

## الخلاصة

الآن API routes تستخدم Sheet Config المحفوظ في localStorage بدلاً من الاعتماد على Environment Variables فقط. هذا يسمح للمستخدمين بتخصيص إعدادات الشيت من الواجهة واستخدامها في جميع عمليات التحديث.

**النتيجة**: تكامل كامل بين Sheet Config Management و API Routes! 🎉 