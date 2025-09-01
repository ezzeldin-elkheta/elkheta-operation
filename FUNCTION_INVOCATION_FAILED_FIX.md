# حل مشكلة FUNCTION_INVOCATION_FAILED

## المشكلة الحالية
- خطأ `FUNCTION_INVOCATION_FAILED` في جميع API routes
- رسالة "A server error has occurred"
- المشكلة تؤثر على `test-simple` و `test-sheets-connection`

## السبب المحتمل
المشكلة على الأرجح هي **خطأ في الكود** أو **مشكلة في المكتبات** أو **مشكلة في Vercel Functions**.

## خطوات التشخيص والحل

### 1. اختبار تدريجي
استخدم الأزرار بالترتيب التالي:

1. **Debug Environment** - يتحقق من متغيرات البيئة
2. **Test Simple API** - يختبر API بسيط بدون مكتبات خارجية
3. **Test Sheets Basic** - يختبر Google Sheets API بطريقة مبسطة
4. **Test Connection** - يختبر الاتصال الكامل

### 2. فحص السجلات في Vercel
1. اذهب إلى [Vercel Dashboard](https://vercel.com/dashboard)
2. اختر مشروعك
3. اذهب إلى "Functions" 
4. افحص سجلات:
   - `test-simple`
   - `test-sheets-basic`
   - `test-sheets-connection`

### 3. المشاكل المحتملة والحلول

#### أ) مشكلة في googleapis library
**الأعراض**: خطأ في require أو import
**الحل**:
```bash
# تأكد من وجود googleapis في package.json
npm install googleapis@latest
```

#### ب) مشكلة في Node.js version
**الأعراض**: خطأ في syntax أو features غير مدعومة
**الحل**:
```json
// في vercel.json
{
  "functions": {
    "pages/api/**/*.js": {
      "runtime": "nodejs18.x"
    }
  }
}
```

#### ج) مشكلة في timeout
**الأعراض**: FUNCTION_INVOCATION_FAILED مع timeout
**الحل**:
```json
// في vercel.json
{
  "functions": {
    "pages/api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

#### د) مشكلة في memory
**الأعراض**: FUNCTION_INVOCATION_FAILED بسبب memory limit
**الحل**:
```json
// في vercel.json
{
  "functions": {
    "pages/api/**/*.js": {
      "memory": 1024
    }
  }
}
```

### 4. إصلاحات سريعة

#### تحديث vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "pages/api/**/*.js",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/test-simple",
      "dest": "/pages/api/test-simple.js"
    },
    {
      "src": "/api/test-sheets-basic",
      "dest": "/pages/api/test-sheets-basic.js"
    },
    {
      "src": "/api/test-sheets-connection",
      "dest": "/pages/api/test-sheets-connection.js"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ],
  "functions": {
    "pages/api/**/*.js": {
      "runtime": "nodejs18.x",
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "env": {
    "NODE_ENV": "production"
  }
}
```

#### تحديث package.json
```json
{
  "dependencies": {
    "googleapis": "^128.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 5. اختبار مباشر من المتصفح
افتح هذه الروابط مباشرة:

```
https://your-app.vercel.app/api/test-simple
https://your-app.vercel.app/api/test-sheets-basic
https://your-app.vercel.app/api/test-sheets-connection
```

### 6. إذا استمرت المشكلة

#### أ) إعادة نشر التطبيق
```bash
# حذف cache وإعادة نشر
vercel --prod --force
```

#### ب) فحص package-lock.json
```bash
# حذف وإعادة تثبيت dependencies
rm -rf node_modules package-lock.json
npm install
```

#### ج) فحص environment variables
- تأكد من صحة JSON في Vercel
- تأكد من عدم وجود أحرف خاصة
- أعد حفظ environment variables

### 7. اختبار نهائي

بعد تطبيق الإصلاحات:
1. اضغط "Test Simple API" - يجب أن ينجح
2. اضغط "Test Sheets Basic" - يجب أن ينجح أو يعطي خطأ واضح
3. اضغط "Test Connection" - يجب أن ينجح أو يعطي خطأ واضح

### 8. جمع معلومات التشخيص

إذا استمرت المشكلة، اجمع:
1. نتيجة جميع الاختبارات
2. السجلات من Vercel Dashboard
3. محتوى package.json
4. محتوى vercel.json
5. أي رسائل خطأ تظهر

## ملاحظات مهمة

1. **تأخير في التطبيق**: قد يستغرق نشر التغييرات 2-5 دقائق
2. **Cache**: قد تحتاج لمسح cache المتصفح
3. **Environment Variables**: تأكد من حفظ التغييرات في Vercel
4. **Dependencies**: تأكد من تحديث جميع المكتبات

## إذا لم تحل المشكلة

1. **تحقق من Vercel Status**: [status.vercel.com](https://status.vercel.com)
2. **تحقق من Node.js version**: تأكد من استخدام Node.js 18+
3. **تحقق من memory usage**: قد تحتاج لزيادة memory limit
4. **تحقق من timeout**: قد تحتاج لزيادة timeout 