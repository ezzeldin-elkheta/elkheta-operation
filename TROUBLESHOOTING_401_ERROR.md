# حل مشكلة خطأ 401 في Google Sheets

## المشكلة الحالية
- متغيرات البيئة مُضبطة بشكل صحيح ✅
- JSON صالح ويحتوي على جميع الحقول المطلوبة ✅
- لكن لا يزال يظهر خطأ 401 عند محاولة الاتصال

## السبب المحتمل
المشكلة على الأرجح هي **عدم منح الصلاحيات** لحساب الخدمة على Google Sheet.

## الحلول

### 1. منح الصلاحيات لحساب الخدمة

#### الخطوة الأولى: معرفة بريد حساب الخدمة
من البيانات المعروضة، بريد حساب الخدمة هو:
```
elkheta-operation@gen-lang-client-0238517871.iam.gserviceaccount.com
```

#### الخطوة الثانية: مشاركة الشيت
1. افتح Google Sheet: `1ohaHyfkJFQ0vdiu5ewjdgULXrBurHIhNP4orZJmaRO8`
2. اضغط زر "Share" (مشاركة) في الأعلى
3. أضف البريد الإلكتروني: `elkheta-operation@gen-lang-client-0238517871.iam.gserviceaccount.com`
4. امنح صلاحية **"Editor"** (محرر)
5. اضغط "Send" (إرسال)

### 2. التحقق من إعدادات الشيت

#### تأكد من:
- الشيت ليس محمي بكلمة مرور
- الشيت ليس في وضع "Restricted" (مقيد)
- حساب الخدمة له صلاحية "Editor" وليس "Viewer"

### 3. اختبار الحل

بعد منح الصلاحيات:
1. اذهب للتطبيق
2. اضغط "Debug Environment" → "Test Connection"
3. يجب أن تظهر رسالة نجاح

### 4. إذا استمرت المشكلة

#### تحقق من:
1. **Google Cloud Console**:
   - اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
   - اختر المشروع: `gen-lang-client-0238517871`
   - اذهب إلى "APIs & Services" → "Enabled APIs"
   - تأكد من تفعيل "Google Sheets API"

2. **Service Account Permissions**:
   - اذهب إلى "IAM & Admin" → "Service Accounts"
   - ابحث عن: `elkheta-operation@gen-lang-client-0238517871.iam.gserviceaccount.com`
   - تأكد من أن الحساب مفعل

3. **Spreadsheet ID**:
   - تأكد من أن ID صحيح: `1ohaHyfkJFQ0vdiu5ewjdgULXrBurHIhNP4orZJmaRO8`
   - تأكد من أن الشيت موجود ويمكن الوصول إليه

### 5. رسائل الخطأ المتوقعة

#### إذا ظهر "Access denied":
- تأكد من منح صلاحية "Editor" لحساب الخدمة

#### إذا ظهر "Spreadsheet not found":
- تحقق من صحة Spreadsheet ID
- تأكد من أن الشيت موجود

#### إذا ظهر "API not enabled":
- فعّل Google Sheets API في Google Cloud Console

## ملاحظات مهمة

1. **تأخير في التطبيق**: قد يستغرق منح الصلاحيات بضع دقائق لتطبيقها
2. **إعادة تشغيل**: قد تحتاج لإعادة تشغيل Vercel Functions بعد تغيير الصلاحيات
3. **التأكد من البريد**: تأكد من كتابة بريد حساب الخدمة بشكل صحيح تماماً

## اختبار سريع

يمكنك اختبار الاتصال مباشرة من المتصفح:
```
https://your-vercel-app.vercel.app/api/test-sheets-connection
```

يجب أن ترى رسالة نجاح أو خطأ واضح. 