// import { extend, isFunction, isNumber, isString } from 'nerv-utils'
import { extend, isFunction, isNumber, isString, clone } from 'nerv-utils'
import CurrentOwner from './current-owner'
import createElement from './vdom/create-element'
import createVText from './vdom/create-vtext'
import { createVoid } from './vdom/create-void'
import patch from './vdom/patch'
import {
  Component,
  isNullOrUndef,
  CompositeComponent,
  isComponent,
  isInvalid,
  VText,
  VVoid,
  VNode,
  VType,
  EMPTY_OBJ
} from 'nerv-shared'
import FullComponent from './full-component'
import Stateless from './stateless-component'
import { unmount } from './vdom/unmount'
import Ref from './vdom/ref'
import options from './options'

const readyComponents: any[] = []

function errorCatcher (fn: Function, component: Component<any, any>) {
  try {
    return fn()
  } catch (error) {
    errorHandler(component, error)
  }
}

function errorHandler (component: Component<any, any>, error) {
  let boundary

  while (true) {
    if (isFunction(component.componentDidCatch)) {
      boundary = component
      break
    } else if (component._parentComponent) {
      component = component._parentComponent
    } else {
      break
    }
  }

  if (boundary) {
    const _disable = boundary._disable
    boundary._disable = false
    boundary.componentDidCatch(error)
    boundary._disable = _disable
  } else {
    throw error
  }
}

/**
 * 检查渲染出来的东西是什么
 * 保证返回一个virtualNode
 * @param {*} rendered
 * @returns {(VText | VVoid | VNode)}
 */
function ensureVirtualNode (rendered: any): VText | VVoid | VNode {
  // 如果是字符串或者数字
  if (isNumber(rendered) || isString(rendered)) {
    // 创建文字型节点
    return createVText(rendered)
  } else if (isInvalid(rendered)) {
    // 如果render的值不能转换为vDom那么久直接转化为空节点
    return createVoid()
  }
  return rendered
}

export function mountVNode (vnode, parentContext: any, parentComponent?) {
  return createElement(vnode, false, parentContext, parentComponent)
}

/**
 * 挂载前的准备
 *
 * @export
 * @param {FullComponent} vnode
 * @param {object} parentContext
 * @param {*} parentComponent
 * @returns
 */
export function mountComponent (
  vnode: FullComponent,
  parentContext: object,
  parentComponent
) {
  const ref = vnode.ref
  vnode.component = new vnode.type(vnode.props, parentContext)
  const component = vnode.component
  component.vnode = vnode
  if (isComponent(parentComponent)) {
    component._parentComponent = parentComponent
  }
  if (isFunction(component.componentWillMount)) {
    errorCatcher(() => {
      (component as any).componentWillMount()
    }, component)
    component.state = component.getState()
    component.clearCallBacks()
  }
  component._dirty = false
  const rendered = renderComponent(component)
  rendered.parentVNode = vnode
  component._rendered = rendered
  if (isFunction(component.componentDidMount)) {
    readyComponents.push(component)
  }
  if (!isNullOrUndef(ref)) {
    Ref.attach(vnode, ref, vnode.dom as Element)
  }
  const dom = (vnode.dom = mountVNode(
    rendered,
    getChildContext(component, parentContext),
    component
  ) as Element)
  component._disable = false
  return dom
}

/**
 * 挂载无状态组件
 *
 * @export
 * @param {Stateless} vnode
 * @param {*} parentContext
 * @returns
 */
export function mountStatelessComponent (vnode: Stateless, parentContext) {
  const rendered = vnode.type(vnode.props, parentContext)
  vnode._rendered = ensureVirtualNode(rendered)
  vnode._rendered.parentVNode = vnode
  return (vnode.dom = mountVNode(vnode._rendered, parentContext) as Element)
}

export function getChildContext (component, context = EMPTY_OBJ) {
  // 调用component的getChildContext中计算出context
  if (component.getChildContext) {
    // 拓展原来的context
    // 从context中取值仍然交给getChildContext
    return extend(clone(context), component.getChildContext())
  }
  // 不存在getChildContext取值的话直接传递到下一层
  return clone(context)
}

/**
 * 调用组件的render方法渲染
 *
 * @export
 * @param {Component<any, any>} component
 * @returns
 */
export function renderComponent (component: Component<any, any>) {
  CurrentOwner.current = component // 问题 用途不明 确定当前渲染的组件吗？
  let rendered
  // errCatcher 统一处理错误
  errorCatcher(() => {
    rendered = component.render()
  }, component)
  //
  rendered = ensureVirtualNode(rendered)
  CurrentOwner.current = null
  return rendered
}

export function flushMount () {
  if (!readyComponents.length) {
    return
  }
  // @TODO: perf
  const queue = readyComponents.slice(0)
  readyComponents.length = 0
  queue.forEach((item) => {
    if (isFunction(item)) {
      item()
    } else if (item.componentDidMount) {
      errorCatcher(() => {
        item.componentDidMount()
      }, item)
    }
  })
}

export function reRenderComponent (
  prev: CompositeComponent,
  current: CompositeComponent
) {
  const component = (current.component = prev.component)
  const nextProps = current.props
  const nextContext = current.context
  component._disable = true
  if (isFunction(component.componentWillReceiveProps)) {
    errorCatcher(() => {
      (component as any).componentWillReceiveProps(nextProps, nextContext)
    }, component)
  }
  component._disable = false
  component.prevProps = component.props
  component.prevState = component.state
  component.prevContext = component.context
  component.props = nextProps
  component.context = nextContext
  if (!isNullOrUndef(current.ref)) {
    Ref.update(prev, current)
  }
  return updateComponent(component)
}

export function reRenderStatelessComponent (
  prev: Stateless,
  current: Stateless,
  parentContext: Object,
  domNode: Element
) {
  const lastRendered = prev._rendered
  const rendered = current.type(current.props, parentContext)
  rendered.parentVNode = current
  current._rendered = rendered
  return (current.dom = patch(lastRendered, rendered, lastRendered && lastRendered.dom || domNode, parentContext))
}

/**
 * 更新组建的核心函数
 *
 * @export
 * @param {*} component
 * @param {boolean} [isForce=false]
 * @returns {HTMLElement}
 */
export function updateComponent (component, isForce = false) {
  let vnode = component.vnode
  let dom = vnode.dom
  const props = component.props // 获取组件的属性
  const state = component.getState() // 获取应该更新的State
  const context = component.context
  const prevProps = component.prevProps || props
  const prevState = component.prevState || component.state
  const prevContext = component.prevContext || context
  component.props = prevProps // 问题 prevProps和props什么区别
  component.context = prevContext
  let skip = false

  // shouldComponentUpdate 返回 false的时候 跳过更新
  if (
    !isForce &&
    isFunction(component.shouldComponentUpdate) &&
    component.shouldComponentUpdate(props, state, context) === false
  ) {
    skip = true
  } else if (isFunction(component.componentWillUpdate)) {
    // 利用errorCatcher统一处理报错信息
    errorCatcher(() => {
      component.componentWillUpdate(props, state, context)
    }, component)
  }
  // 问题 下面这一串是为了什么？
  component.props = props
  component.state = state
  component.context = context
  component._dirty = false
  // 如果更新不被跳过
  if (!skip) {
    // 取出上次渲染的结果 方便进行patch
    const lastRendered = component._rendered
    // 根据props和state把新的组件render出来
    const rendered = renderComponent(component)
    // 问题 这又是什么？
    rendered.parentVNode = vnode
    // 获取context
    const childContext = getChildContext(component, context)
    // 获取parentNode 作为 patch后的挂载点 IE6以上就支持parentNode获取 但不支持对parentNode 的其他方法 如 replaceWith
    const parentDom = lastRendered.dom && lastRendered.dom.parentNode
    // 核心功能
    dom = vnode.dom = patch(lastRendered, rendered, parentDom || null, childContext)
    // patch 后就可获取到生成的dom
    component._rendered = rendered
    // 触发componentDidUpdate
    if (isFunction(component.componentDidUpdate)) {
      errorCatcher(() => {
        component.componentDidUpdate(prevProps, prevState, context)
      }, component)
    }
    options.afterUpdate(vnode) // 问题？ 这是在干嘛 额外的钩子
    while (vnode = vnode.parentVNode) {
      // 如果是合成类型或者无状态组件？
      if ((vnode.vtype & (VType.Composite | VType.Stateless)) > 0) {
        vnode.dom = dom // 就挂上去
      }
    }
  }
  // 保存之前状态
  component.prevProps = component.props
  component.prevState = component.state
  component.prevContext = component.context
  // ？
  component.clearCallBacks()
  flushMount()
  return dom
}

export function unmountComponent (vnode: FullComponent) {
  const component = vnode.component
  if (isFunction(component.componentWillUnmount)) {
    errorCatcher(() => {
      (component as any).componentWillUnmount()
    }, component)
  }
  component._disable = true
  unmount(component._rendered)
  if (!isNullOrUndef(vnode.ref)) {
    Ref.detach(vnode, vnode.ref, vnode.dom as any)
  }
}

export function unmountStatelessComponent (vnode: Stateless) {
  unmount(vnode._rendered)
}
