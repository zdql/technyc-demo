/**
 * Next.js Image Generation Template with Echo SDK
 *
 * This template demonstrates how to build an AI image generation app using:
 * - Echo SDK for authentication and token management
 * - AI SDK for OpenAI and Gemini image generation
 * - Next.js App Router for server-side rendering
 *
 * Key features:
 * 1. Authentication: Automatic login/logout with Echo SDK
 * 2. Image Generation: Support for both OpenAI and Gemini models
 * 3. Image Editing: Upload images and edit with AI prompts
 * 4. History: Persistent image gallery with download/copy actions
 * 5. Responsive Design: Works on desktop and mobile
 *
 * Usage Examples:
 * - Text-to-Image: "A beautiful sunset over mountains"
 * - Image Editing: Upload photo + "Make this black and white"
 * - Model Switching: Choose between GPT Image or Gemini Flash
 */

import { isSignedIn } from '@/echo';
import ImageGenerator from '@/components/image-generator';
import { EchoWidget } from '@/components/echo-tokens';

import { EchoSignIn } from '@merit-systems/echo-next-sdk/client';

/**
 * Main application page
 *
 * Server component that checks authentication status and renders
 * either the sign-in page or the main image generation interface
 */
export default async function Home() {
  // Check authentication status using Echo SDK
  const _isSignedIn = await isSignedIn();

  // Main application interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* NYC Themed Header */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 text-white">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm sm:text-lg flex-shrink-0">NY</div>
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">
              <span className="sm:hidden">TS Studio</span>
              <span className="hidden sm:inline">Times Square Studio</span>
            </h1>
          </div>
          <div className="mt-2 sm:mt-0 flex items-center justify-end sm:justify-start gap-3 flex-shrink-0">
            {_isSignedIn && (
              <div className="scale-90 sm:scale-100 origin-right">
                <EchoWidget />
              </div>
            )}
          </div>
        </header>
      </div>

      {/* Main image generation interface */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 -mt-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <ImageGenerator />
        </div>

        {!_isSignedIn && (
          <div className="absolute inset-0 backdrop-blur-[2px] bg-black/20 flex items-center justify-center rounded-xl">
            <EchoSignIn />
          </div>
        )}
      </div>
    </div>
  );
}
