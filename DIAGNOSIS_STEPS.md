# خطوات تشخيص مشكلة خطأ 500

## المشكلة الحالية
- خطأ 500 في `/api/test-sheets-connection`
- رسالة "A server error has occurred" 
- مشكلة في parsing JSON response

## خطوات التشخيص

### 1. اختبار API البسيط أولاً
1. اذهب للتطبيق
2. اضغط "Test Simple API"
3. **إذا نجح**: المشكلة في Google Sheets API
4. **إذا فشل**: المشكلة في Vercel Functions أو البيئة

### 2. فحص السجلات (Logs)
في Vercel Dashboard:
1. اذهب إلى [Vercel Dashboard](https://vercel.com/dashboard)
2. اختر مشروعك
3. اذهب إلى "Functions" → "test-sheets-connection"
4. افحص السجلات للحصول على تفاصيل الخطأ

### 3. اختبار مباشر من المتصفح
افتح هذه الروابط مباشرة في المتصفح:

```
https://your-app.vercel.app/api/test-simple
https://your-app.vercel.app/api/test-sheets-connection
```

### 4. المشاكل المحتملة والحلول

#### أ) مشكلة في googleapis library
**الأعراض**: خطأ في import أو require
**الحل**: 
```bash
npm install googleapis@latest
```

#### ب) مشكلة في environment variables
**الأعراض**: خطأ في parsing JSON
**الحل**: 
- تحقق من صحة JSON في Vercel
- تأكد من عدم وجود أحرف خاصة

#### ج) مشكلة في Vercel Function timeout
**الأعراض**: FUNCTION_INVOCATION_FAILED
**الحل**: 
- زيادة timeout في vercel.json
- تبسيط الكود

#### د) مشكلة في Google Cloud API
**الأعراض**: خطأ في authentication
**الحل**: 
- تفعيل Google Sheets API
- منح الصلاحيات لحساب الخدمة

### 5. اختبار تدريجي

#### الخطوة 1: اختبار البيئة
```javascript
// test-simple.js
console.log('Environment check...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
```

#### الخطوة 2: اختبار parsing JSON
```javascript
// test-credentials.js
const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
console.log('Credentials parsed successfully');
```

#### الخطوة 3: اختبار Google Auth
```javascript
// test-auth.js
const auth = new google.auth.GoogleAuth({ credentials });
console.log('Auth initialized');
```

#### الخطوة 4: اختبار Sheets API
```javascript
// test-sheets.js
const sheets = google.sheets({ version: 'v4', auth });
console.log('Sheets client created');
```

### 6. إصلاحات سريعة

#### إذا كانت المشكلة في googleapis:
```bash
# في package.json
"googleapis": "^128.0.0"
```

#### إذا كانت المشكلة في timeout:
```json
// في vercel.json
{
  "functions": {
    "pages/api/test-sheets-connection.js": {
      "maxDuration": 30
    }
  }
}
```

#### إذا كانت المشكلة في environment:
- تأكد من أن JSON صحيح في Vercel
- أعد نشر التطبيق بعد تغيير environment variables

### 7. اختبار نهائي

بعد تطبيق الإصلاحات:
1. اضغط "Test Simple API" - يجب أن ينجح
2. اضغط "Test Connection" - يجب أن ينجح أو يعطي خطأ واضح
3. افحص السجلات للتأكد من عدم وجود أخطاء

### 8. إذا استمرت المشكلة

#### جمع معلومات التشخيص:
1. نتيجة "Test Simple API"
2. نتيجة "Test Connection" 
3. السجلات من Vercel Dashboard
4. محتوى environment variables (بدون القيم الحساسة)

#### الاتصال بالدعم:
- قدم معلومات التشخيص
- ارفق السجلات الكاملة
- وضح الخطوات المتبعة

## ملاحظات مهمة

1. **تأخير في التطبيق**: قد يستغرق نشر التغييرات بضع دقائق
2. **Cache**: قد تحتاج لمسح cache المتصفح
3. **Environment Variables**: تأكد من حفظ التغييرات في Vercel
4. **Dependencies**: تأكد من تحديث جميع المكتبات 