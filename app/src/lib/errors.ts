import { StorageError, ValidationError } from '../data'

export function errorMessage(e: unknown): string {
  if (e instanceof StorageError) {
    return e.reason === 'quota'
      ? '저장 공간이 부족합니다. 백업 파일로 내보내 주세요.'
      : '저장할 수 없습니다. 브라우저 저장소가 차단되어 있는지 확인해 주세요.'
  }
  if (e instanceof ValidationError) return e.message
  return '알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.'
}
