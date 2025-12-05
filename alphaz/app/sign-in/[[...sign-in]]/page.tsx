import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn 
        appearance={{
          elements: {
            formButtonPrimary: 'bg-orange-500 hover:bg-orange-600 text-sm normal-case',
            card: 'shadow-lg',
            headerTitle: 'text-2xl font-bold',
            headerSubtitle: 'text-gray-600',
            formFieldInput: 'rounded-md',
            footerActionLink: 'text-orange-500 hover:text-orange-600',
          }
        }}
      />
    </div>
  );
}