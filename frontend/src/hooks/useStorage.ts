import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getStoragePath } from '@/lib/utils';

export type BucketName = 'avatars' | 'medical-documents' | 'payment-receipts' | 'facility-photos' | 'identity-documents' | 'coach-certificates';

export function useStorage() {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (
    file: File,
    bucket: BucketName,
    path?: string
  ): Promise<string | null> => {
    try {
      setUploading(true);

      if (!file || !file.name) {
        throw new Error('No se ha seleccionado ningún archivo válido');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = path ? `${path}/${fileName}` : fileName;

      // Upload file
      const { error: uploadError, data } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // For private buckets, we return the filePath to store in DB
      if (bucket === 'payment-receipts') {
        return filePath;
      }

      // For public buckets, we return the publicUrl
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error: unknown) {
      console.error('Error uploading file:', error);
      const message = error instanceof Error ? error.message : 'No se pudo subir el archivo';
      toast({
        title: '❌ Error',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (bucket: BucketName, filePath: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) throw error;

      toast({
        title: '✅ Archivo eliminado',
        description: 'El archivo se ha eliminado correctamente',
      });

      return true;
    } catch (error: unknown) {
      console.error('Error deleting file:', error);
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el archivo';
      toast({
        title: '❌ Error',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  };

  const getFileUrl = (bucket: BucketName, filePath: string): string => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(getStoragePath(filePath));

    return data.publicUrl;
  };

  const createSignedPathUrl = async (bucket: BucketName, filePath: string, expiresIn = 3600): Promise<string | null> => {
    try {
      const cleanPath = getStoragePath(filePath);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath, expiresIn);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  };

  return {
    uploadFile,
    deleteFile,
    getFileUrl,
    createSignedPathUrl,
    uploading
  };
}
