import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  increment,
  Unsubscribe
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType, sanitizeForFirestore } from '../firebase/firebase';
import { ProjectFile, Attachment } from '../../types';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB max limit

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'json',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'fig', 'sketch', 'zip'
]);

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateUploadFile(file: File): void {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File "${file.name}" exceeds the 15 MB maximum upload limit.`);
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type ".${ext}" is not permitted. Supported: PDF, Office docs, images, SVG, JSON, CSV, Figma, Sketch, ZIP.`);
  }
}

async function optimizeImageIfNeeded(file: File): Promise<Blob | File> {
  const compressible = ['image/jpeg', 'image/png', 'image/webp'];
  if (!compressible.includes(file.type) || file.size < 1.5 * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 2048;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob && blob.size < file.size ? blob : file);
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

async function uploadToStorage(
  storagePath: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ url: string; sizeFormatted: string }> {
  validateUploadFile(file);
  const payload = await optimizeImageIfNeeded(file);
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, payload, {
      contentType: file.type || 'application/octet-stream'
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => {
        reject(new Error(`Storage upload failed (${error.code || 'unknown'}): ${error.message}`));
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, sizeFormatted: formatFileSize(payload.size) });
        } catch (err: any) {
          reject(new Error(`Failed to obtain download URL: ${err?.message || String(err)}`));
        }
      }
    );
  });
}

export const fileService = {
  // Upload binary file to Firebase Storage and record metadata in Firestore
  async uploadProjectFile(params: {
    projectId: string;
    file?: File | null;
    name?: string;
    folder: string;
    url?: string;
    type?: string;
    size?: string;
    uploadedBy: string;
    onProgress?: (pct: number) => void;
  }): Promise<ProjectFile> {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    let finalUrl = params.url?.trim() || '';
    let finalName = params.name?.trim() || params.file?.name || 'document';
    let finalSize = params.size || '—';
    let finalType = params.type || 'document';

    if (params.file) {
      const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `projects/${params.projectId}/files/${fileId}_${safeName}`;
      const uploaded = await uploadToStorage(storagePath, params.file, params.onProgress);
      finalUrl = uploaded.url;
      finalName = params.name?.trim() || params.file.name;
      finalSize = uploaded.sizeFormatted;
      finalType = params.file.type || params.file.name.split('.').pop()?.toLowerCase() || 'document';
    } else if (!finalUrl) {
      throw new Error('Please choose a file to upload or provide a valid external document URL.');
    }

    const projectFile: ProjectFile = sanitizeForFirestore({
      id: fileId,
      projectId: params.projectId,
      name: finalName,
      folder: params.folder || 'General',
      size: finalSize,
      type: finalType,
      url: finalUrl,
      uploadedBy: params.uploadedBy,
      uploadedAt: now,
      downloadsCount: 0
    });

    const path = `projects/${params.projectId}/files/${fileId}`;
    try {
      await setDoc(doc(db, 'projects', params.projectId, 'files', fileId), projectFile);
      return projectFile;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  // Upload binary attachment for a task or approval submission
  async uploadAttachment(
    projectId: string,
    file: File,
    uploadedBy: string,
    onProgress?: (pct: number) => void
  ): Promise<Attachment> {
    const attId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `projects/${projectId}/attachments/${attId}_${safeName}`;
    const uploaded = await uploadToStorage(storagePath, file, onProgress);

    return {
      id: attId,
      name: file.name,
      url: uploaded.url,
      size: uploaded.sizeFormatted,
      type: file.type || file.name.split('.').pop()?.toLowerCase() || 'file',
      uploadedAt: new Date().toISOString(),
      uploadedBy
    };
  },

  // Increment file download count
  async incrementDownloadCount(projectId: string, fileId: string): Promise<void> {
    const path = `projects/${projectId}/files/${fileId}`;
    try {
      await updateDoc(doc(db, 'projects', projectId, 'files', fileId), {
        downloadsCount: increment(1)
      });
    } catch (error) {
      console.warn('Could not increment download count:', error);
    }
  },

  // Delete project file from Firestore (and Storage if hosted in Firebase Storage)
  async deleteProjectFile(projectId: string, fileId: string, fileUrl?: string): Promise<void> {
    const path = `projects/${projectId}/files/${fileId}`;
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'files', fileId));
      if (fileUrl && fileUrl.includes('firebasestorage')) {
        try {
          const storageRef = ref(storage, fileUrl);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.warn('Storage blob cleanup skipped:', storageErr);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Real-time listener for project files
  listenToProjectFiles(projectId: string, callback: (files: ProjectFile[]) => void): Unsubscribe {
    const path = `projects/${projectId}/files`;
    return onSnapshot(
      collection(db, 'projects', projectId, 'files'),
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as ProjectFile))
          .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
        callback(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  }
};
