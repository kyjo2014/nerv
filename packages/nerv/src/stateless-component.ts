import { VType } from 'nerv-shared'
import { isFunction } from 'nerv-utils'
import {
  mountStatelessComponent,
  unmountStatelessComponent,
  reRenderStatelessComponent
} from './lifecycle'

/**
 * 作用： 主要是测试吧？？主动进行各个状态的控制
 *
 * @class StateLessComponent
 */
class StateLessComponent {
  vtype = VType.Stateless
  type: Function
  name: string
  _owner: any
  props: any
  _rendered: any
  key: any
  dom: Element | null
  constructor (type, props) {
    this.type = type
    this._owner = props.owner
    delete props.owner
    this.props = props
    this.key = props.key
  }

  init (parentContext) {
    return mountStatelessComponent(this, parentContext)
  }

  update (previous, current, parentContext) {
    const { props, context } = current
    const shouldComponentUpdate = props.onShouldComponentUpdate
    if (
      isFunction(shouldComponentUpdate) &&
      !shouldComponentUpdate(previous.props, props, context)
    ) {
      // shouldComponentUpdate === false 时 当前与之前的渲染内容相同。
      current._rendered = previous._rendered
      return previous.dom
    }
    return reRenderStatelessComponent(previous, this, parentContext, previous.dom)
  }

  destroy () {
    unmountStatelessComponent(this)
  }
}

export default StateLessComponent
