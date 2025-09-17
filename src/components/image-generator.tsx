'use client';

import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';

import { fileToDataUrl } from '@/lib/image-utils';
import type {
  EditImageRequest,
  GeneratedImage,
  GenerateImageRequest,
  ImageResponse,
  ModelConfig,
  ModelOption,
} from '@/lib/types';
import { ImageHistory } from './image-history';

declare global {
  interface Window {
    __promptInputActions?: {
      addFiles: (files: File[] | FileList) => void;
      clear: () => void;
      openFileDialog: () => void;
    };
  }
}

/**
 * Available AI models for image generation
 * These models integrate with the Echo SDK to provide different image generation capabilities
 */
const models: ModelConfig[] = [
  { id: 'openai', name: 'GPT Image' },
  { id: 'gemini', name: 'Gemini Flash Image' },
];

/**
 * API functions for image generation and editing
 * These functions communicate with the Echo SDK backend routes
 */

// ===== API FUNCTIONS =====
async function generateImage(
  request: GenerateImageRequest
): Promise<ImageResponse> {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function editImage(request: EditImageRequest): Promise<ImageResponse> {
  const response = await fetch('/api/edit-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Main ImageGenerator component
 *
 * This component demonstrates how to integrate Echo SDK with AI image generation:
 * - Uses PromptInput for unified input handling with attachments
 * - Supports both text-to-image generation and image editing
 * - Maintains history of all generated/edited images
 * - Provides seamless model switching between OpenAI and Gemini
 */
export default function ImageGenerator() {
  const [model, setModel] = useState<ModelOption>('gemini');
  const [imageHistory, setImageHistory] = useState<GeneratedImage[]>([]);
  const promptInputRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  // Simple camera toggle
  const toggleCamera = useCallback(() => {
    setShowCamera(!showCamera);
  }, [showCamera]);

  // Capture photo using react-webcam
  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Convert data URL to blob and then to file
        fetch(imageSrc)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            window.__promptInputActions?.addFiles([file]);
            setShowCamera(false); // Close camera after capture
          })
          .catch(err => {
            console.error('Error converting image:', err);
            alert('Failed to capture photo. Please try again.');
          });
      } else {
        alert('Camera not ready. Please try again.');
      }
    }
  }, []);

  // Handle adding files to the input from external triggers (like from image history)
  const handleAddToInput = useCallback((files: File[]) => {
    const actions = window.__promptInputActions;
    if (actions) {
      actions.addFiles(files);
    }
  }, []);

  const clearForm = useCallback(() => {
    promptInputRef.current?.reset();
    const actions = window.__promptInputActions;
    if (actions) {
      actions.clear();
    }
  }, []);

  // Component to bridge PromptInput context with external file operations
  function AttachmentsBridge() {
    const attachments = usePromptInputAttachments();

    // Store reference to attachment actions for external use
    useEffect(() => {
      window.__promptInputActions = {
        addFiles: attachments.add,
        clear: attachments.clear,
        openFileDialog: attachments.openFileDialog,
      };

      return () => {
        delete window.__promptInputActions;
      };
    }, [attachments]);

    return null;
  }

  // Component to show photo selection status
  function PhotoSelectionStatus() {
    const attachments = usePromptInputAttachments();
    const hasFiles = attachments.files.length > 0;

    if (hasFiles) {
      return null; // Don't show anything when files are present
    }

    return (
      <div className="p-4 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg mx-3 my-3">
        <p className="text-sm">📷 No photo selected</p>
        <p className="text-xs mt-1">Use Camera or Gallery buttons below to add a photo</p>
      </div>
    );
  }

  // Enhanced camera access function
  const triggerCameraCapture = useCallback(() => {
    if (showCamera) {
      // If camera is already open, capture the photo
      capturePhoto();
    } else {
      // Show camera for live preview
      toggleCamera();
    }
  }, [showCamera, capturePhoto, toggleCamera]);

  // Fallback file picker function
  const triggerFilePicker = useCallback(() => {
    window.__promptInputActions?.openFileDialog?.();
  }, []);

  // Submit button that has access to attachment state
  function SubmitButton() {
    const attachments = usePromptInputAttachments();

    return (
      <PromptInputSubmit 
        status={submitting ? 'submitted' : undefined}
        disabled={!attachments.files.length}
        className="flex-1 sm:flex-initial whitespace-nowrap px-2 sm:px-4 h-9 text-xs sm:text-sm min-w-0"
        size="sm"
      >
        <span className="sm:hidden flex items-center gap-1">
          <Sparkles size={16} />
        </span>
        <span className="hidden sm:inline flex items-center gap-2">
          <Sparkles size={16} />
          Generate NYC Shot
        </span>
      </PromptInputSubmit>
    );
  }

  /**
   * Handles form submission for both image generation and editing
   * - Text-only: generates new image using selected model
   * - Text + attachments: edits uploaded images using Gemini
   */
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const hasAttachments = Boolean(message.files?.length);

      // Require a single selfie/photo
      if (!hasAttachments || (message.files?.length || 0) === 0) {
        return;
      }
      if ((message.files?.length || 0) > 1) {
        // Only one photo allowed
        return;
      }

      setSubmitting(true);

      const isEdit = true;
      const prompt =
        'Place this person into a vibrant, photorealistic scene in Times Square, New York City, at golden hour. Maintain the person’s identity and pose. Blend lighting and shadows realistically with neon signage, billboards, and reflective wet pavement. Use cinematic color grading, street-level perspective, and crowd ambiance. High resolution, natural skin tones, no artifacts.';

      // Generate unique ID for this request
      const imageId = `img_${Date.now()}`;

      // Convert attachment blob URLs to permanent data URLs for persistent display
      const attachmentDataUrls =
        message.files && message.files.length > 0
          ? await Promise.all(
              message.files
                .filter(f => f.mediaType?.startsWith('image/'))
                .map(async f => {
                  try {
                    const response = await fetch(f.url);
                    const blob = await response.blob();
                    return await fileToDataUrl(
                      new File([blob], f.filename || 'image', {
                        type: f.mediaType,
                      })
                    );
                  } catch (error) {
                    console.error(
                      'Failed to convert attachment to data URL:',
                      error
                    );
                    return f.url; // fallback
                  }
                })
            )
          : undefined;

      // Create placeholder entry immediately for optimistic UI
      const placeholderImage: GeneratedImage = {
        id: imageId,
        prompt,
        model: model,
        timestamp: new Date(),
        attachments: attachmentDataUrls,
        isEdit,
        isLoading: true,
      };

      // Add to history immediately for responsive UI
      setImageHistory(prev => [placeholderImage, ...prev]);

      try {
        let imageUrl: ImageResponse['imageUrl'];

        if (isEdit) {
          const imageFiles =
            message.files?.filter(
              file =>
                file.mediaType?.startsWith('image/') || file.type === 'file'
            ) || [];

          if (imageFiles.length === 0) {
            throw new Error('No image files found in attachments');
          }

          try {
            const imageUrls = await Promise.all(
              imageFiles.map(async imageFile => {
                // Convert blob URL to data URL for API
                const response = await fetch(imageFile.url);
                const blob = await response.blob();
                return await fileToDataUrl(
                  new File([blob], 'image', { type: imageFile.mediaType })
                );
              })
            );

            const result = await editImage({
              prompt,
              imageUrls,
              provider: model,
            });
            imageUrl = result.imageUrl;
          } catch (error) {
            console.error('Error processing image files:', error);
            throw error;
          }
        } else {
          const result = await generateImage({ prompt, model });
          imageUrl = result.imageUrl;
        }

        // Update the existing placeholder entry with the result
        setImageHistory(prev =>
          prev.map(img =>
            img.id === imageId ? { ...img, imageUrl, isLoading: false } : img
          )
        );
      } catch (error) {
        console.error(
          `Error ${isEdit ? 'editing' : 'generating'} image:`,
          error
        );

        // Update the placeholder entry with error state
        setImageHistory(prev =>
          prev.map(img =>
            img.id === imageId
              ? {
                  ...img,
                  isLoading: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Failed to generate image',
                }
              : img
          )
        );
      } finally {
        setSubmitting(false);
      }
    },
    [model]
  );

  return (
    <div className="space-y-6">
      <div className="text-center mb-4 sm:mb-6 px-4 sm:px-0">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">Place Yourself in Times Square</h2>
        <p className="text-sm sm:text-base text-gray-600 mb-1 sm:mb-0">Take a selfie with your camera or choose a photo from your gallery</p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Use the Camera button to take a new photo, or Gallery to choose an existing one</p>
      </div>

      <PromptInput
        ref={promptInputRef}
        onSubmit={handleSubmit}
        className="relative"
        globalDrop
        multiple={false}
        accept="image/*"
        capture="user"
      >
        <AttachmentsBridge />
        <PromptInputBody>
          <PromptInputAttachments>
            {attachment => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          {showCamera ? (
            <div className="p-6 mx-3 my-3">
              <div className="flex justify-center mb-6">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  className="rounded-xl shadow-lg border max-w-full"
                  width={600}
                  height={450}
                  videoConstraints={{
                    facingMode: "user"
                  }}
                />
              </div>
              <div className="flex justify-center gap-2 sm:gap-3">
                <Button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 text-sm sm:text-base"
                >
                  <span className="sm:hidden">📸 Take</span>
                  <span className="hidden sm:inline">📸 Take Photo</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={toggleCamera}
                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2 text-sm sm:text-base"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <PhotoSelectionStatus />
          )}
          {/* Hidden textarea for form submission compatibility */}
          <PromptInputTextarea
            className="sr-only"
            defaultValue=""
            tabIndex={-1}
          />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputModelSelect
              onValueChange={value => {
                setModel(value as ModelOption);
              }}
              value={model}
            >
              <PromptInputModelSelectTrigger>
                <PromptInputModelSelectValue />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                {models.map(model => (
                  <PromptInputModelSelectItem key={model.id} value={model.id}>
                    {model.name}
                  </PromptInputModelSelectItem>
                ))}
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>
          </PromptInputTools>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearForm}
              className="h-9 w-9 p-0 shrink-0"
            >
              <X size={16} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={triggerCameraCapture}
              disabled={submitting}
              className="flex-1 sm:flex-initial whitespace-nowrap px-2 sm:px-3 h-9 text-xs sm:text-sm min-w-0"
            >
              <span className="sm:hidden">{submitting ? '⏳' : showCamera ? '📸' : '📷'}</span>
              <span className="hidden sm:inline">{submitting ? 'Processing…' : showCamera ? '📸 Capture' : '📷 Camera'}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={triggerFilePicker}
              disabled={submitting}
              className="flex-1 sm:flex-initial whitespace-nowrap px-2 sm:px-3 h-9 text-xs sm:text-sm min-w-0"
            >
              <span className="sm:hidden">📁</span>
              <span className="hidden sm:inline">📁 Gallery</span>
            </Button>
            <SubmitButton />
          </div>
        </PromptInputToolbar>
      </PromptInput>

      <ImageHistory
        imageHistory={imageHistory}
        onAddToInput={handleAddToInput}
      />
    </div>
  );
}
