import { isFunction, extend, clone, isArray } from 'nerv-utils'
import { enqueueRender } from './render-queue'
import { updateComponent } from './lifecycle'
import { Props, ComponentLifecycle, Refs, EMPTY_OBJ } from 'nerv-shared'

/**
 * 声明组件中必须包含_rendered和dom属性
 *
 * @interface Component
 * @extends {ComponentLifecycle<P, S>}
 * @template P
 * @template S
 */
interface Component<P = {}, S = {}> extends ComponentLifecycle<P, S> {
  _rendered: any
  dom: any
}

/**
 * 组件的构造函数
 *
 * @class Component
 * @implements {ComponentLifecycle<P, S>}
 * @template P
 * @template S
 */
class Component<P, S> implements ComponentLifecycle<P, S> {
  public static defaultProps: {}
  state: Readonly<S>
  props: Readonly<P> & Readonly<Props>
  context: any
  _dirty = true
  _disable = true
  _pendingStates: any[] = []
  _pendingCallbacks: Function[]
  refs: Refs
  isReactComponent: Object

  constructor (props?: P, context?: any) {
    // 初始化state
    if (!this.state) {
      this.state = {} as S
    }
    // 如果props不存在则初始化为空对象
    this.props = props || ({} as P)
    // 不存在context就初始化为空对象
    this.context = context || EMPTY_OBJ
    // refs 也一样
    this.refs = {}
  }

  /**
   * 表明setState可接受的参数
   *
   * @template K
   * @param {(((prevState: Readonly<S>, props: P) => Pick<S, K> | S)
   *       | (Pick<S, K> | S))} state
   * @param {() => void} [callback]
   * @memberof Component
   */
  setState<K extends keyof S> (
    state:
      | ((prevState: Readonly<S>, props: P) => Pick<S, K> | S) // 这里的Pick<S,K>是指返回一个扩展了prevStateS的对象
      | (Pick<S, K> | S),
    callback?: () => void
  ): void {
    if (state) {
      (this._pendingStates = this._pendingStates || []).push(state)
    }
    if (isFunction(callback)) {
      (this._pendingCallbacks = this._pendingCallbacks || []).push(callback)
    }
    if (!this._disable) {
      enqueueRender(this)
    }
  }

  getState () {
    // tslint:disable-next-line:no-this-assignment
    const { _pendingStates, state, props } = this
    // 如果没有等候合并的state 就返回当前state
    if (!_pendingStates.length) {
      return state
    }
    const stateClone = clone(state)
    // API熟练运用  ( abcd = [1,2,3] ) === abcd.concat() // false
    // 利用concat创建一个新数组
    const queue = _pendingStates.concat()
    // 拷贝出来后就可以把原来的数组长度置位0，相当于清空了数组（而不是新创建空数组减少了消耗）
    this._pendingStates.length = 0

    queue.forEach((nextState) => {
      // 检查渲染队列判断是否为函数
      if (isFunction(nextState)) {
        nextState = nextState.call(this, state, props)
      }
      extend(stateClone, nextState)
    })

    // 在不更改当前state的情况下获取及时的state
    // 或许是这里的问题导致京东快报列表页更新失败?
    return stateClone
  }

  /**
   * 没什么好说的触发所有的回调函数
   *
   * @memberof Component
   */
  clearCallBacks () {
    if (isArray(this._pendingCallbacks)) {
      while (this._pendingCallbacks.length) {
        (this._pendingCallbacks.pop() as any).call(this)
      }
    }
  }

  /**
   * 强制当前组件更新
   *
   * @param {Function} [callback]
   * @memberof Component
   */
  forceUpdate (callback?: Function) {
    if (isFunction(callback)) {
      (this._pendingCallbacks = this._pendingCallbacks || []).push(callback)
    }
    updateComponent(this, true)
  }

  // tslint:disable-next-line
  public render(nextProps?: P, nextState?, nextContext?): any {}
}

Component.prototype.isReactComponent = EMPTY_OBJ

export default Component
