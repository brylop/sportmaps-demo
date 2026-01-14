import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type BucketName = 'avatars' | 'medical-documents' | 'payment-receipts' | 'facility-photos';

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

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      toast({
        title: '✅ Archivo subido',
        description: 'El archivo se ha subido correctamente',
      });

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo subir el archivo',
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
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: '❌ Error',
        description: error.message || 'No se pudo eliminar el archivo',
        variant: 'destructive',
      });
      return false;
    }
  };

  const getFileUrl = (bucket: BucketName, filePath: string): string => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  };

  return {
    uploadFile,
    deleteFile,
    getFileUrl,
    uploading
  };
}
