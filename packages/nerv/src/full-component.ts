import { VType, Component, CompositeComponent, Ref } from 'nerv-shared'
import {
  mountComponent,
  reRenderComponent,
  unmountComponent
} from './lifecycle'

/**
 * 组合component = 受控组件
 *
 * @class ComponentWrapper
 * @implements {CompositeComponent}
 */
class ComponentWrapper implements CompositeComponent {
  vtype = VType.Composite
  type: any
  name: string
  _owner: any
  props: any
  component: Component<any, any>
  context: any
  key: any
  dom: Element | null
  _rendered: any
  ref: Ref

  /**
   * Creates an instance of ComponentWrapper.
   * @param { string | Function | Component<any, any> } type createElement中传入的组件
   * @param {Object} props createElement中的properties经过转化后的数据
   * @memberof ComponentWrapper
   */
  constructor (type, props) {
    this.type = type //
    this.name = type.name || type.toString().match(/^function\s*([^\s(]+)/)[1] // 问题？ type 是从哪里传入的 答案：从createElement传入
    // 问题2 createElement中传到full component应该只有class的组件为什么还要取函数名？
    type.displayName = this.name // 增加displayName属性
    this._owner = props.owner // 在render时候会把component赋值给owner
    delete props.owner
    // this.ref保存ref属性
    if ((this.ref = props.ref)) {
      delete props.ref
    }
    this.props = props
    this.key = props.key || null
    this.dom = null
  }

  /**
   * 这个init只用于测试吗？
   *
   * @param {*} parentContext
   * @param {*} parentComponent
   * @returns
   * @memberof ComponentWrapper
   */
  init (parentContext, parentComponent) {
    return mountComponent(this, parentContext, parentComponent)
  }

  /**
   * 主动触发某个组件更新
   *
   * @param {*} previous
   * @param {*} current
   * @param {*} parentContext
   * @param {*} [domNode]
   * @returns
   * @memberof ComponentWrapper
   */
  update (previous, current, parentContext, domNode?) {
    this.context = parentContext
    return reRenderComponent(previous, this)
  }

  /**
   * unmountVNodeAtDom会调用这个方法主动触发移除节点
   *
   * @memberof ComponentWrapper
   */
  destroy () {
    unmountComponent(this)
  }
}

export default ComponentWrapper
