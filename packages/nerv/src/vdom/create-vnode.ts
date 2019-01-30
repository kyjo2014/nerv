import {
  Props,
  VType,
  VNode,
  VirtualChildren,
  Component,
  EMPTY_OBJ
} from 'nerv-shared'

/**
 * 创建vitrualNode的工厂
 *
 * @param {string} type
 * @param {Props} props
 * @param {VirtualChildren} children
 * @param {*} key
 * @param {string} namespace
 * @param {Component<any, any>} owner
 * @param {(Function | string | null | undefined)} ref
 * @returns {VNode}
 */
function createVNode (
  type: string,
  props: Props,
  children: VirtualChildren,
  key,
  namespace: string,
  owner: Component<any, any>,
  ref: Function | string | null | undefined
): VNode {
  return {
    type,
    key: key || null,
    vtype: VType.Node,
    props: props || EMPTY_OBJ,
    children,
    namespace: namespace || null,
    _owner: owner,
    dom: null,
    ref: ref || null
  }
}

export default createVNode
