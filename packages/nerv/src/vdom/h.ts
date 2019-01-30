import createVNode from './create-vnode'
import createVText from './create-vtext'
import { createVoid } from './create-void'
import {
  Props,
  VirtualChildren,
  VirtualNode,
  isValidElement,
  EMPTY_CHILDREN,
  VNode
} from 'nerv-shared'
import { isString, isArray, isNumber } from 'nerv-utils'

/**
 * h函数和createElement， create-Element有什么关系？？？？
 *
 * @param {string} type  html标签的内容
 * @param {Props} props
 * @param {VirtualChildren} [children]
 * @returns
 */
function h (type: string, props: Props, children?: VirtualChildren) {
  let childNodes
  if (props.children) {
    if (!children) {
      children = props.children
    }
  }
  if (isArray(children)) {
    childNodes = []
    addChildren(childNodes, children as any, type)
  } else if (isString(children) || isNumber(children)) {
    children = createVText(String(children))
  } else if (!isValidElement(children)) {
    children = EMPTY_CHILDREN
  }
  props.children = childNodes !== undefined ? childNodes : children
  return createVNode(
    type,
    props,
    props.children as any[],
    props.key,
    props.namespace,
    props.owner,
    props.ref
  ) as VNode
}

function addChildren (
  childNodes: VirtualNode[],
  children: VirtualNode | VirtualNode[],
  type: string
) {
  if (isString(children) || isNumber(children)) {
    childNodes.push(createVText(String(children))) // 文字节点
  } else if (isValidElement(children)) { // 元素节点
    childNodes.push(children)
  } else if (isArray(children)) { // 递归处理子节点
    for (let i = 0; i < children.length; i++) {
      addChildren(childNodes, children[i], type)
    }
  } else {
    childNodes.push(createVoid()) // 其他情况加插入空节点
  }
}

export default h
