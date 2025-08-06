# إصلاح مشكلة Vercel Configuration

## المشكلة
```
Error: The `functions` property cannot be used in conjunction with the `builds` property. Please remove one of them.
```

## الحل المطبق
تم إزالة `functions` property واستخدام `config` داخل `builds` بدلاً منه.

### قبل الإصلاح:
```json
{
  "builds": [
    {
      "src": "pages/api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "functions": {
    "pages/api/**/*.js": {
      "runtime": "nodejs18.x",
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

### بعد الإصلاح:
```json
{
  "builds": [
    {
      "src": "pages/api/**/*.js",
      "use": "@vercel/node",
      "config": {
        "runtime": "nodejs18.x",
        "maxDuration": 30,
        "memory": 1024
      }
    }
  ]
}
```

## الخطوات التالية

### 1. إعادة نشر التطبيق
```bash
vercel --prod
```

### 2. اختبار API Routes
بعد النشر، اختبر الأزرار بالترتيب:

1. **Debug Environment** - يتحقق من متغيرات البيئة
2. **Test Simple API** - يختبر API بسيط
3. **Test Sheets Basic** - يختبر Google Sheets API
4. **Test Connection** - يختبر الاتصال الكامل

### 3. فحص السجلات
في Vercel Dashboard:
1. اذهب إلى Functions
2. افحص سجلات API routes
3. تأكد من عدم وجود أخطاء

### 4. إذا استمرت المشكلة

#### أ) تحقق من package.json
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

#### ب) تحديث dependencies
```bash
npm install googleapis@latest
```

#### ج) إعادة تثبيت dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### 5. اختبار مباشر
افتح هذه الروابط في المتصفح:
```
https://your-app.vercel.app/api/test-simple
https://your-app.vercel.app/api/test-sheets-basic
https://your-app.vercel.app/api/test-sheets-connection
```

## النتائج المتوقعة

### إذا نجح الإصلاح:
- لن تظهر رسالة خطأ Vercel CLI
- ستعمل جميع API routes بشكل طبيعي
- ستظهر رسائل نجاح أو خطأ واضحة

### إذا فشل الإصلاح:
- تحقق من السجلات في Vercel Dashboard
- تأكد من صحة environment variables
- تحقق من تفعيل Google Sheets API

## ملاحظات مهمة

1. **تأخير في التطبيق**: قد يستغرق نشر التغييرات 2-5 دقائق
2. **Cache**: قد تحتاج لمسح cache المتصفح
3. **Environment Variables**: تأكد من حفظ التغييرات في Vercel
4. **Dependencies**: تأكد من تحديث جميع المكتبات

## إذا استمرت المشكلة

1. **تحقق من Vercel Status**: [status.vercel.com](https://status.vercel.com)
2. **تحقق من Node.js version**: تأكد من استخدام Node.js 18+
3. **تحقق من memory usage**: قد تحتاج لزيادة memory limit
4. **تحقق من timeout**: قد تحتاج لزيادة timeout 