export { default as nextTick } from './next-tick'
export { default as shallowEqual } from './shallow-equal'
export { SimpleMap, MapClass } from './simple-map'
export * from './is'
export { isBrowser, doc } from './env'

export function getPrototype (obj) {
  /* istanbul ignore next */
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(obj)
  } else if (obj.__proto__) {
    return obj.__proto__
  }
  /* istanbul ignore next */
  return obj.constructor.prototype
}

/**
 * 判断属性是事件监听
 *
 * @export
 * @param {string} attr
 * @returns {boolean}
 */
export function isAttrAnEvent (attr: string): boolean {
  return attr[0] === 'o' && attr[1] === 'n'
}
// extend只是浅复制属性
// 问题？ 为什么这里要用一个闭包去返回函数？
// 答案，这样就能保证只在初始化的时候if判断一次，其他时候不需要每次extend都重复判断操作
const extend = ((): (<S, F>(source: S, from: F) => S | F & S) => {
  // 如果object中有assign直接使用Object.assign进行复制
  if ('assign' in Object) {
    return <S, F>(source: S, from: F): S | F & S => {
      if (!from) {
        return source
      }
      Object.assign(source, from)
      return source
    }
  } else {
    return <S, F>(source: S, from: F): S | F & S => {
      if (!from) {
        return source
      }
      // 使用hasOwnProperty搭配for in 循环遍历对象自身属性
      for (const key in from) {
        if (from.hasOwnProperty(key)) {
          (source as any)[key] = from[key]
        }
      }
      return source
    }
  }
})()

export { extend }

/**
 * 克隆的逻辑等价于 空对象扩展成另一个对象
 *
 * @export
 * @template T
 * @param {T} obj
 * @returns {(T | {})}
 */
export function clone<T> (obj: T): T | {} {
  return extend({}, obj)
}
