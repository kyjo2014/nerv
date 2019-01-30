import { nextTick } from 'nerv-utils'
import { updateComponent } from './lifecycle'

let items: any[] = []

/**
 * 如果传入的组件没被标记为dirty就更新
 * 插入需要更新的队列中如果当前只有传入组件需要更新name就在nextTick中触发渲染函数
 * 只要其中任何一项不符合都代表不是立刻触发渲染的时机
 *
 * @export
 * @param {Component} component
 */
export function enqueueRender (component) {
  // 很巧妙的设计，利用短路运算符完成分支判断
  // tslint:disable-next-line:no-conditional-assignment
  if (!component._dirty && (component._dirty = true) && items.push(component) === 1) {
    nextTick(rerender)
  }
}

/**
 * 渲染函数，按顺序从渲染队列中取出组件并调用渲染的函数
 *
 * @export
 */
export function rerender () {
  let p
  const list = items
  items = []
  // tslint:disable-next-line:no-conditional-assignment
  while ((p = list.pop())) {
    if (p._dirty) {
      updateComponent(p)
    }
  }
}
