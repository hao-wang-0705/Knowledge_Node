/**
 * 图片处理工具函数
 * 
 * 提供图片上传、验证、转换等功能
 */

/**
 * 支持的图片 MIME 类型
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
] as const;

export type SupportedImageType = typeof SUPPORTED_IMAGE_TYPES[number];

/**
 * 图片数据接口
 */
export interface ImageData {
  /** 唯一标识 */
  id: string;
  /** 原始文件 */
  file: File;
  /** base64 编码（包含 data:image/xxx;base64, 前缀） */
  base64: string;
  /** 预览 URL (createObjectURL) */
  preview: string;
  /** 文件名 */
  name: string;
  /** 文件大小 (bytes) */
  size: number;
  /** MIME type */
  type: string;
}

/**
 * 图片验证结果
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 图片配置
 */
export const IMAGE_CONFIG = {
  /** 最大文件大小 (4MB) */
  maxSize: 4 * 1024 * 1024,
  /** 最大文件大小（人类可读） */
  maxSizeLabel: '4MB',
  /** 支持的格式列表 */
  supportedTypes: SUPPORTED_IMAGE_TYPES,
  /** 支持的格式（人类可读） */
  supportedTypesLabel: 'PNG, JPG, GIF, WEBP',
} as const;

/**
 * 生成唯一 ID
 */
export function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 验证图片文件
 * @param file 文件对象
 * @returns 验证结果
 */
export function validateImage(file: File): ImageValidationResult {
  // 验证文件类型
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as SupportedImageType)) {
    return {
      valid: false,
      error: `不支持的图片格式。支持的格式：${IMAGE_CONFIG.supportedTypesLabel}`,
    };
  }

  // 验证文件大小
  if (file.size > IMAGE_CONFIG.maxSize) {
    return {
      valid: false,
      error: `图片大小超过限制。最大支持 ${IMAGE_CONFIG.maxSizeLabel}`,
    };
  }

  return { valid: true };
}

/**
 * 将文件转换为 base64 编码
 * @param file 文件对象
 * @returns Promise<string> base64 编码字符串
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * 从剪贴板事件中获取图片文件
 * @param event ClipboardEvent
 * @returns File[] 图片文件数组
 */
export function getImagesFromClipboard(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];

  const images: File[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // 检查是否是图片
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        // 为剪贴板图片生成有意义的文件名
        const ext = item.type.split('/')[1] || 'png';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const renamedFile = new File(
          [file],
          `clipboard-${timestamp}.${ext}`,
          { type: file.type }
        );
        images.push(renamedFile);
      }
    }
  }

  return images;
}

/**
 * 从拖拽事件中获取图片文件
 * @param event DragEvent
 * @returns File[] 图片文件数组
 */
export function getImagesFromDrop(event: DragEvent): File[] {
  const files = event.dataTransfer?.files;
  if (!files) return [];

  const images: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // 检查是否是支持的图片类型
    if (SUPPORTED_IMAGE_TYPES.includes(file.type as SupportedImageType)) {
      images.push(file);
    }
  }

  return images;
}

/**
 * 从文件输入中获取图片文件
 * @param event 文件输入事件
 * @returns File[] 图片文件数组
 */
export function getImagesFromInput(event: React.ChangeEvent<HTMLInputElement>): File[] {
  const files = event.target.files;
  if (!files) return [];

  const images: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (SUPPORTED_IMAGE_TYPES.includes(file.type as SupportedImageType)) {
      images.push(file);
    }
  }

  return images;
}

/**
 * 将文件处理为 ImageData 对象
 * @param file 文件对象
 * @returns Promise<ImageData>
 */
export async function processImageFile(file: File): Promise<ImageData> {
  const base64 = await fileToBase64(file);
  const preview = URL.createObjectURL(file);

  return {
    id: generateImageId(),
    file,
    base64,
    preview,
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

/**
 * 批量处理图片文件
 * @param files 文件数组
 * @returns Promise<{ images: ImageData[], errors: string[] }>
 */
export async function processImageFiles(
  files: File[]
): Promise<{ images: ImageData[]; errors: string[] }> {
  const images: ImageData[] = [];
  const errors: string[] = [];

  for (const file of files) {
    // 验证图片
    const validation = validateImage(file);
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`);
      continue;
    }

    try {
      const imageData = await processImageFile(file);
      images.push(imageData);
    } catch (error) {
      errors.push(`${file.name}: 处理失败`);
    }
  }

  return { images, errors };
}

/**
 * 释放图片预览 URL
 * 用于组件卸载时清理内存
 * @param images ImageData 数组
 */
export function revokeImagePreviews(images: ImageData[]): void {
  images.forEach((image) => {
    URL.revokeObjectURL(image.preview);
  });
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化的字符串（如 "1.5 MB"）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 从 base64 字符串中提取 MIME 类型
 * @param base64 base64 字符串
 * @returns MIME 类型或 undefined
 */
export function getMimeTypeFromBase64(base64: string): string | undefined {
  const match = base64.match(/^data:([^;]+);base64,/);
  return match ? match[1] : undefined;
}

/**
 * 检查是否是有效的图片 base64 字符串
 * @param base64 base64 字符串
 * @returns boolean
 */
export function isValidImageBase64(base64: string): boolean {
  const mimeType = getMimeTypeFromBase64(base64);
  return mimeType ? SUPPORTED_IMAGE_TYPES.includes(mimeType as SupportedImageType) : false;
}
