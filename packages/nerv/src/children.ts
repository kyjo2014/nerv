import { isArray } from 'nerv-utils' // 兼容不支持ES6 的浏览器
import {
  isNullOrUndef,
  VirtualChildren,
  EMPTY_CHILDREN,
  isInvalid
} from 'nerv-shared' //

export type IterateFn = (
  value: VirtualChildren | any,
  index: number,
  array: Array<VirtualChildren | any>
) => any

export const Children = {
  map (children: Array<VirtualChildren | any>, fn: IterateFn, ctx: any): any[] {
    if (isNullOrUndef(children)) {
      return children
    } // 如果是false值就直接返回
    children = Children.toArray(children) // 因为children 可能是类数组所以先转成数组
    if (ctx && ctx !== children) {
      fn = fn.bind(ctx) // 在handle中绑定this
    }
    return children.map(fn) // 使用数组自带的map完成遍历
  },
  forEach (
    children: Array<VirtualChildren | any>,
    fn: IterateFn,
    ctx: any
  ): void {
    if (isNullOrUndef(children)) {
      return
    }
    children = Children.toArray(children)
    if (ctx && ctx !== children) {
      fn = fn.bind(ctx)
    }
    for (let i = 0, len = children.length; i < len; i++) {
      const child = isInvalid(children[i]) ? null : children[i] // 问题  未明白原因， 为什么forEach中要统一为null 而map不用

      fn(child, i, children)
    }
  },
  /**
   * 获得children的数量
   *
   * @param {(Array<VirtualChildren | any>)} children
   * @returns {number}
   */
  count (children: Array<VirtualChildren | any>): number {
    children = Children.toArray(children)
    return children.length
  },
  /**
   * 判断children是不是唯一的
   * 问题 这个用处是什么
   * @param {(Array<VirtualChildren | any>)} children
   * @returns {(VirtualChildren | any)}
   */
  only (children: Array<VirtualChildren | any>): VirtualChildren | any {
    children = Children.toArray(children)
    if (children.length !== 1) {
      throw new Error('Children.only() expects only one child.')
    }
    return children[0]
  },

  /**
   * 把children的值统一转换成array类型
   * 避免执行的时候报错
   * @param {(Array<VirtualChildren | any>)} children
   * @returns {(Array<VirtualChildren | any>)}
   */
  toArray (
    children: Array<VirtualChildren | any>
  ): Array<VirtualChildren | any> {
    // false值转为空数组
    if (isNullOrUndef(children)) {
      return []
    }

    // 如果children是数组
    if (isArray(children)) {
      const result = []

      // 扁平化

      flatten(children, result)

      return result
    }

    // 如果不是本函数能够处理的内容，就先用数组包起来
    return EMPTY_CHILDREN.concat(children)
  }
}

/**
 * 数组扁平化
 * [1,2,3,[4,5]] => [1,2,3,4,5]
 * @param {*} arr
 * @param {*} result
 * @returns
 */
function flatten (arr, result) {
  for (let i = 0, len = arr.length; i < len; i++) {
    const value = arr[i]
    if (isArray(value)) {
      flatten(value, result)
    } else {
      result.push(value)
    }
  }
  return result
}
