# React + TypeScript + Vite

## Quick Start
```bash
npm install
npm run dev
```

## Deployment
```bash
# Build locally to test
npm run build

# Deploy to Vercel - optimized for Hobby plan (under 12 functions limit)
git add .
git commit -m "fix test connection"
git push origin main
vercel --prod
```
git reset --hard 2cd90046c9535c9b24b3fa6fcbd1c86f7de34a2a

## API Troubleshooting

If you encounter 404 errors on API endpoints after deployment:

1. **Framework Detection**: Use `--framework=other` when deploying to avoid Vercel mistakenly detecting Next.js

2. **Check API folder structure**: Make sure API endpoints are in the right location:
   - For Vercel functions: Use `/api/` directory (not `/pages/api/`)
   - For endpoints defined in `vercel.json`: Check path mappings are correct

3. **Test API locally**: Run `npm run dev` and test endpoints like `/api/auth-check`

4. **Verify vercel.json**: Ensure routes are correctly mapped and there are no conflicts

5. **Check Vercel logs**: View request logs in the Vercel dashboard for each endpoint

6. **Environment variables**: Ensure environment variables are correctly set in Vercel

## Deployment URLs
- **Production**: https://014-ci7fe1z6f-ezzeldinelkhateebs-projects.vercel.app
- **Inspect**: https://vercel.com/ezzeldinelkhateebs-projects/014/FmkNzmVdXS5YicB7uGibpAFaXW8f

## Project Structure

### API Structure
- `/api/*`: Vercel serverless functions (deployed automatically)
- `/pages/api/*`: Next.js API routes (requires manual routing in vercel.json)

### Key API Endpoints
- `/api/auth-check`: Verify authentication status and API keys
- `/api/proxy/base/videolibrary`: Get library list from Bunny.net
- `/api/proxy/video/library/[libraryId]/collections`: Get collections for a library

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
