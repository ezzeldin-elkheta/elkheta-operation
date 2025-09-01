# Google Sheets Setup Guide

## المشكلة الحالية
تظهر أخطاء 500 و 401 عند محاولة الاتصال بـ Google Sheets. هذا يعني أن متغيرات البيئة لم تُضبط بشكل صحيح على Vercel.

## الحلول المطلوبة

### 1. إضافة متغيرات البيئة على Vercel

اذهب إلى [Vercel Dashboard](https://vercel.com/dashboard) → مشروعك → Settings → Environment Variables

#### أضف المتغيرات التالية:

**GOOGLE_SHEETS_CREDENTIALS_JSON**
- القيمة: محتوى ملف JSON الكامل لحساب الخدمة (Service Account)
- يجب أن يحتوي على: `client_email`, `private_key`, `project_id`

**GOOGLE_SHEETS_SPREADSHEET_ID**
- القيمة: ID الخاص بـ Google Sheet (من الرابط)
- مثال: `1ohaHyfkJFQ0vdiu5ewjdgULXrBurHIhNP4orZJmaRO8`

**GOOGLE_SHEET_NAME** (اختياري)
- القيمة: اسم الورقة داخل الشيت
- افتراضي: `OPERATIONS`

### 2. إنشاء حساب خدمة Google (Service Account)

إذا لم يكن لديك حساب خدمة:

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. أنشئ مشروع جديد أو اختر مشروع موجود
3. فعّل Google Sheets API
4. اذهب إلى "IAM & Admin" → "Service Accounts"
5. أنشئ حساب خدمة جديد
6. أنزل ملف JSON للاعتماد

### 3. منح الصلاحيات للشيت

1. افتح Google Sheet
2. اضغط "Share" (مشاركة)
3. أضف بريد حساب الخدمة (client_email من JSON)
4. امنح صلاحية "Editor"

### 4. اختبار الإعداد

بعد إضافة المتغيرات:

1. اذهب إلى التطبيق
2. اضغط "Debug Environment" لفحص المتغيرات
3. اضغط "Test Connection" لاختبار الاتصال

## استكشاف الأخطاء

### خطأ 401: Unauthorized
- تحقق من وجود `GOOGLE_SHEETS_CREDENTIALS_JSON`
- تأكد من صحة تنسيق JSON
- تحقق من وجود `client_email` و `private_key`

### خطأ 403: Forbidden
- تأكد من منح صلاحيات "Editor" لحساب الخدمة على الشيت
- تحقق من تفعيل Google Sheets API

### خطأ 404: Not Found
- تحقق من صحة `GOOGLE_SHEETS_SPREADSHEET_ID`
- تأكد من وجود الشيت وأن حساب الخدمة له صلاحية الوصول

### خطأ 500: Internal Server Error
- تحقق من سجلات Vercel Functions
- تأكد من صحة تنسيق JSON (لا تنسى `\n` في private_key)

## مثال لملف JSON صحيح

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCs6HFXcpc901BK\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "service-account@project-id.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/service-account%40project-id.iam.gserviceaccount.com"
}
```

## ملاحظات مهمة

1. **لا تشارك ملف JSON** - يحتوي على مفاتيح سرية
2. **احتفظ بنسخة احتياطية** من ملف JSON
3. **راجع الصلاحيات** بانتظام
4. **راقب الاستخدام** في Google Cloud Console 