import { isNullOrUndef, isInvalid, VType, VirtualChildren } from 'nerv-shared'
import { isAttrAnEvent, isArray } from 'nerv-utils'
import Ref from './ref'
import { detachEvent } from '../event'
import options from '../options'

/**
 * 卸载children
 *
 * @export
 * @param {VirtualChildren} children
 * @param {Element} [parentDom]
 */
export function unmountChildren (
  children: VirtualChildren,
  parentDom?: Element
) {
  if (isArray(children)) {
    for (let i = 0, len = children.length; i < len; i++) {
      unmount(children[i], parentDom)
    }
  } else {
    unmount(children, parentDom)
  }
}

/**
 * 从dom树中移除节点
 *
 * @export
 * @param {*} vnode
 * @param {*} [parentDom]
 */
export function unmount (vnode, parentDom?) {
  // 如果vnode不是有效节点直接返回
  if (isInvalid(vnode)) {
    return
  }
  const vtype = vnode.vtype
  // 使用位运算提升性能
  // Bitwise operators for better performance
  // see: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators
  const dom = vnode.dom

  if ((vtype & (VType.Composite | VType.Stateless)) > 0) {
    // 如果是无状态组件或者是合成组件
    options.beforeUnmount(vnode)
    // 直接触发fullComponent提供的destory->unmountComponent->unmount
    // 问题 这里不会触发死循环吗？
    vnode.destroy()
  } else if ((vtype & VType.Node) > 0) {
    // 如果是普通的vDom节点
    const { props, children, ref } = vnode
    // 递归移除他的子节点
    unmountChildren(children)
    // 移除事件监听器
    for (const propName in props) {
      if (isAttrAnEvent(propName)) {
        detachEvent(dom, propName, props[propName])
      }
    }
    if (ref !== null) {
      Ref.detach(vnode, ref, dom)
    }
  } else if (vtype & VType.Portal) {
    // 问题 为什么portal不用移除ref和事件监听器 portal可以绑定事件监听器的
    // 答案？ 难道是等候从dom树上移除节点再自动触发移除监听器吗？
    unmountChildren(vnode.children, vnode.type)
  }

  // 处理完所有vnode树上的关系后才处理dom树中真正节点
  if (!isNullOrUndef(parentDom) && !isNullOrUndef(dom)) {
    parentDom.removeChild(dom)
  }
  // vnode.dom = null
}
