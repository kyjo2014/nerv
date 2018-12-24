import { global } from './env'
export interface Cache<Key, Value> {
  k: Key
  v: Value
}

/**
 * 因为babel默认只转换新的JavaScript句法（syntax），而不转换新的API
 * 所以Map是没有的，所以需要模拟一个map
 *
 * @export
 * @class SimpleMap
 * @template Key
 * @template Value
 */
export class SimpleMap<Key, Value> {
  cache: Array<Cache<Key, Value>>
  size: number
  constructor () {
    this.cache = []
    this.size = 0
  }
  set (k, v) {
    const len = this.cache.length
    // 空map直接插入
    if (!len) {
      this.cache.push({ k, v })
      this.size += 1
      return
    }
    // 非空map且是有相同key的就执行更新
    for (let i = 0; i < len; i++) {
      const item = this.cache[i]
      if (item.k === k) {
        item.v = v
        return
      }
    }
    // 如果不是上述的情况就直接插入了。
    this.cache.push({ k, v })
    this.size += 1
  }

  get (k) {
    const len = this.cache.length
    if (!len) {
      return
    }
    for (let i = 0; i < len; i++) {
      const item = this.cache[i]
      if (item.k === k) {
        return item.v
      }
    }
  }

  has (k) {
    const len = this.cache.length
    if (!len) {
      return false
    }
    for (let i = 0; i < len; i++) {
      const item = this.cache[i]
      if (item.k === k) {
        return true
      }
    }
    return false
  }

  delete (k) {
    const len = this.cache.length
    for (let i = 0; i < len; i++) {
      const item = this.cache[i]
      if (item.k === k) {
        this.cache.splice(i, 1)
        this.size -= 1
        return true
      }
    }
    return false
  }

  clear () {
    let len = this.cache.length
    this.size = 0
    if (!len) {
      return
    }
    while (len) {
      this.cache.pop()
      len--
    }
  }
}

// 检测环境中是不是有Map这个特性， 不然就
export const MapClass: MapConstructor =
  'Map' in global ? Map : (SimpleMap as any)
