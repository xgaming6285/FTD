# Vercel Deployment Guide

## Files Created for Vercel Deployment

1. **`vercel.json`** - Main Vercel configuration file
2. **`api/index.js`** - Vercel-compatible entry point
3. **`.vercelignore`** - Excludes unnecessary files from deployment

## Environment Variables Required

Before deploying, you need to set these environment variables in your Vercel dashboard:

### Required Variables:
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - Secret key for JWT token generation
- `FRONTEND_URL` - Your frontend URL (for CORS)

### Optional Variables:
- `RATE_LIMIT_WINDOW_MS` - Rate limiting window (default: 900000ms = 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

## Deployment Steps

### Method 1: Using Vercel CLI

1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. Follow the prompts and set your environment variables.

### Method 2: Using GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Select the `backend` folder as the root directory
5. Set your environment variables in the Vercel dashboard
6. Deploy

## Important Notes

- The API will be available at `https://your-project.vercel.app/api/`
- Make sure to update your frontend's API URL to point to the Vercel deployment
- Monitor your function execution time (max 30 seconds on free tier)
- File uploads may have size limitations on Vercel

## Testing Deployment

Once deployed, test your API endpoints:
- Health check: `GET https://your-project.vercel.app/api/health`
- Authentication: `POST https://your-project.vercel.app/api/auth/login`

## Troubleshooting

1. **Function timeout**: Increase `maxDuration` in vercel.json (up to limits of your plan)
2. **CORS issues**: Update `FRONTEND_URL` environment variable
3. **Database connection**: Ensure `MONGODB_URI` is correctly set
4. **Build errors**: Check the build logs in Vercel dashboard 