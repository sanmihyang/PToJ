import { useSyncExternalStore } from 'react'
import { repository } from '../data'

/** 저장소 데이터를 구독한다. 데이터는 불변이라 변경될 때만 새 객체가 된다. */
export function useAppData() {
  return useSyncExternalStore(repository.subscribe, repository.getData)
}
