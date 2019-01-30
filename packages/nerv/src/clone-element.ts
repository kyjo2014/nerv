import createElement from './create-element'
import createVText from './vdom/create-vtext'
import { extend, clone, isArray, isString, isNumber } from 'nerv-utils'
import { isVText, isVNode, EMPTY_CHILDREN, VType, isNullOrUndef, isPortal, isInvalid } from 'nerv-shared'
import { createVoid } from './vdom/create-void'

/**
 * 拷贝出相同节点
 *
 * @export
 * @param {*} vnode
 * @param {object} [props] // 同一个vnode 改变填入的props
 * @param {*} children
 * @returns {*}
 */
export default function cloneElement (vnode, props?: object, ...children): any {
  if (isVText(vnode)) {
    return createVText(vnode.text)
  }
  if (isString(vnode) || isNumber(vnode)) {
    return createVText(vnode)
  }
  if (isInvalid(vnode)
    || (!isInvalid(vnode) && isPortal(vnode.vtype, vnode))
    || (vnode && (vnode.vtype & VType.Void))) {
    return createVoid()
  }
  // 先拷贝 props 避免改变，再extend值 ，问题：为什么还要再clone一次？
  const properties = clone(extend(clone(vnode.props), props))
  if (vnode.namespace) {
    properties.namespace = vnode.namespace
  }
  if ((vnode.vtype & VType.Composite) && !isNullOrUndef(vnode.ref)) {
    properties.ref = vnode.ref
  }
  let childrenTmp =
    (arguments.length > 2 ?
      [].slice.call(arguments, 2) :
      vnode.children || properties.children) || []
  if (childrenTmp.length) {
    if (childrenTmp.length === 1) {
      childrenTmp = children[0]
    }
  }
  if (isArray(vnode)) {
    return vnode.map((item) => {
      return cloneElement(item)
    })
  }
  const newVNode = createElement(vnode.type, properties)
  if (isArray(childrenTmp)) {
    let _children = childrenTmp.map((child) => {
      return cloneElement(child, child.props)
    })
    if (_children.length === 0) {
      _children = EMPTY_CHILDREN
    }
    if (isVNode(newVNode)) {
      newVNode.children = _children
    }
    newVNode.props.children = _children
  } else if (childrenTmp) {
    if (isVNode(newVNode)) {
      newVNode.children = cloneElement(childrenTmp)
    }
    newVNode.props.children = cloneElement(childrenTmp, childrenTmp.props)
  }
  return newVNode
}
