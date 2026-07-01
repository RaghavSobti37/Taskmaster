import React from 'react';

import { SignIn, useAuth } from '@clerk/react';

import { isClerkConfigured } from '../../config/clerk';

import {

  clerkAuthAppearance,

  clerkAuthLocalization,

  clerkAuthShellClass,

} from '../../config/clerkAppearance';



function ClerkSignInSkeleton() {

  return (

    <div className="w-full space-y-4 animate-pulse" aria-hidden>

      <div className="h-7 rounded-lg bg-white/10" />

      <div className="h-4 w-2/3 rounded bg-white/5" />

      <div className="h-11 rounded-lg bg-white/10" />

      <div className="h-11 rounded-lg bg-white/8" />

      <div className="h-11 rounded-lg bg-teal-300/20" />

    </div>

  );

}



export default function ClerkSignInBlock() {

  if (!isClerkConfigured()) return null;

  return <ClerkSignInInner />;

}



function ClerkSignInInner() {

  const { isLoaded } = useAuth();



  return (

    <div className={clerkAuthShellClass}>

      {!isLoaded ? <ClerkSignInSkeleton /> : null}

      <div className={isLoaded ? 'w-full' : 'sr-only'}>

        <SignIn

          routing="path"

          path="/login"

          signUpUrl="/register"

          forceRedirectUrl="/dashboard"

          fallbackRedirectUrl="/dashboard"

          appearance={clerkAuthAppearance}

          localization={clerkAuthLocalization}

        />

      </div>

    </div>

  );

}

