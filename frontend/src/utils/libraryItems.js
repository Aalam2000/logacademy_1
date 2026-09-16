// Общие хелперы отображения ресурсов «Базы знаний» (файл/квиз/ссылка) —
// используются и на странице «База знаний» (KnowledgeBasePage.js), и на
// вкладке «Урок» (LessonPage.js), чтобы бейдж типа/подтипа выглядел
// одинаково в обоих местах.

export const TYPE_META = {
  material: { icon: '📄', label: 'Файл' },
  quiz: { icon: '🧩', label: 'Квиз' },
  link: { icon: '🔗', label: 'Ссылка' },
};

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Короткая подпись типа файла по content_type — для бейджа в таблице.
export function materialTypeLabel(contentType) {
  if (!contentType) return 'Файл';
  if (contentType.includes('pdf')) return 'PDF';
  if (contentType.includes('wordprocessingml') || contentType.includes('msword')) return 'DOCX';
  if (contentType.includes('spreadsheetml') || contentType.includes('excel')) return 'XLSX';
  if (contentType.includes('presentationml') || contentType.includes('powerpoint')) return 'PPTX';
  if (contentType.startsWith('image/')) return contentType.split('/')[1]?.toUpperCase() || 'Изображение';
  if (contentType.startsWith('video/')) return 'Видео';
  if (contentType.startsWith('audio/')) return 'Аудио';
  if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('7z')) return 'Архив';
  if (contentType.startsWith('text/')) return 'Текст';
  return contentType.split('/')[1]?.toUpperCase() || contentType;
}

export function subtypeLabel(item) {
  if (item.resource_type === 'material') return materialTypeLabel(item.content_type);
  if (item.resource_type === 'quiz') return item.template_type || '—';
  return 'Ссылка';
}

export function resourceKey(resourceType, resourceId) {
  return `${resourceType}:${resourceId}`;
}
