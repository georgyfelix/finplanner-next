import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

console.log('--- ENV CHECK ---');
console.log('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY EXISTS:', !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
console.log('CLERK_SECRET_KEY EXISTS:', !!process.env.CLERK_SECRET_KEY);
console.log('NEXT_PUBLIC_CLERK_SIGN_IN_URL:', process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL);
console.log('NEXT_PUBLIC_CLERK_SIGN_UP_URL:', process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL);
console.log('-----------------');

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',    '/(api|trpc)(.*)',
    '/__clerk/(.*)',  ],
};
