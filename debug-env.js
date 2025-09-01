import dotenv from 'dotenv';
dotenv.config();

console.log('All environment variables containing "BUNNY":');
Object.keys(process.env).forEach(key => {
    if (key.includes('BUNNY')) {
        const value = process.env[key];
        const masked = value ? value.substring(0, 4) + '*'.repeat(Math.max(0, value.length - 8)) + value.slice(-4) : 'undefined';
        console.log(`${key}=${masked}`);
    }
});

console.log('\nFull VITE_BUNNY_API_KEY:');
console.log(process.env.VITE_BUNNY_API_KEY);
