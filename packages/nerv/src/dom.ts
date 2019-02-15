import { isValidElement as isValidNervElement, VType, isComponent, isInvalid } from 'nerv-shared'
import { nextTick } from 'nerv-utils'
import { getChildContext } from './lifecycle'
import { render } from './render'
import { unmount } from './vdom/unmount'
import createElement from './create-element'
import Component from './component'

/**
 * 移除dom中的component
 *
 * @export
 * @param {HTMLElement} dom
 * @returns
 */
export function unmountComponentAtNode (dom) {
  const component = dom._component
  // 如果是Nerv的虚拟节点
  if (isValidNervElement(component)) {
    // 移除节点
    unmount(component, dom)
    // 因为dom
    delete dom._component
    return true
  }
  return false
}

export function findDOMNode (component) {
  if (isInvalid(component)) {
    return null
  }
  return isComponent(component)
    ? component.vnode.dom
    : isValidNervElement(component)
      ? component.dom : component
}

export function createFactory (type) {
  return createElement.bind(null, type)
}

class WrapperComponent<P, S> extends Component<P, S> {
  getChildContext () {
    // tslint:disable-next-line
    return this.props.context
  }

  render () {
    return this.props.children
  }
}

export function unstable_renderSubtreeIntoContainer (
  parentComponent,
  vnode,
  container,
  callback
) {
  // @TODO: should handle props.context?
  const wrapper = createElement(
    WrapperComponent,
    { context: getChildContext(parentComponent, parentComponent.context) },
    vnode
  )
  const rendered = render(wrapper as any, container)
  if (callback) {
    callback.call(rendered)
  }
  return rendered
}

export function isValidElement (element) {
  return (
    isValidNervElement(element) && (element.vtype & (VType.Composite | VType.Node)) > 0
  )
}

export const unstable_batchedUpdates = nextTick
